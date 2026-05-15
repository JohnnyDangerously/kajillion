# Hot Path Cleanup / Low-Level WebGPU Architecture

Date: 2026-05-14

Scope: frame pacing for Kajillion's WebGPU renderer at 50k-1M nodes. This track is about reducing pass churn, CPU command encoding, bind-group/resource lifetime churn, and CPU-GPU synchronization. It is not a generic WebGPU checklist.

## Current Local Baseline

Kajillion already has several serious hot-path wins in place:

- WebGPU storage-buffer vertex pulling for point positions, line endpoint positions, and point status (`src/modules/Points/draw-points.wgsl`, `src/modules/Lines/draw-curve-line.wgsl`).
- Local luma.gl 9.2.6 patches for `stepMode`, storage-binding reflection, timestamp query routing, and keyed bind-group caching (`patches/`, `docs/luma-gl-upstream-issues.md`).
- WebGPU timestamp-query pool with deferred `mapAsync` and staging-buffer pooling (`src/perf/timer-query-pool-webgpu.ts`).
- Raw WebGPU MSAA canvas pass escape hatch because luma.gl does not expose `resolveTarget` (`src/render/msaa-target.ts`, `src/index.ts`).
- Compute force-link and force-sample paths, plus a compute texture-to-storage sync for positions.
- Idle-frame skip and async WebGPU point-position snapshots to avoid synchronous readback in interactive frames.

The remaining underexploited work is therefore narrower: separate production pass shape from profiling pass shape, reduce luma `Model` state churn in the canvas path, build explicit frame resource arenas, and use indirect/bundled/raw paths only where they remove measurable CPU jitter or enable GPU-generated work counts.

## Sources And Kajillion Implications

| Source | Relevant point | Implication for Kajillion |
|---|---|---|
| [WebGPU Bind Group best practices](https://toji.dev/webgpu-best-practices/bind-groups.html) | Bind groups point at resources; they do not snapshot resource contents. Updating buffers behind a stable bind group is valid. | Stop calling `setBindings()` every frame for stable point/line draw resources. Create hot-path bind groups once per resource tuple and only update buffer contents/uniform offsets. |
| [WebGPU Bind Group Layouts](https://webgpufundamentals.org/webgpu/lessons/webgpu-bind-group-layouts.html) | Most validation moves to bind-group creation; draw/dispatch mainly checks layout compatibility. Auto layouts cannot share bind groups across pipelines. | Hand-declare layouts for hot pipelines that should share resource groups. Avoid `layout: 'auto'`/reflection on new raw hot paths. |
| [WebGPU Render Bundle best practices](https://toji.dev/webgpu-best-practices/render-bundles.html) | Bundles reduce JS-to-GPU-process validation/encoding overhead; resource contents can change without re-encoding; they do not help GPU-bound fill/vertex cost. | Render bundles are worth a small prototype only for CPU-frame p95, not expected GPU-time wins. They pair best with indirect draw counts so the bundle survives LOD/culling count changes. |
| [WebGPU Speed and Optimization](https://webgpufundamentals.org/webgpu/lessons/webgpu-optimization.html) | Consolidating per-object uniform writes into one large buffer can remove many `writeBuffer` calls; mapped transfer buffers can remove a copy but require copy commands. | Build a 256-byte-aligned frame uniform arena/ring before chasing shader micro-opts. Kajillion has many small `UniformStore.setUniforms()` calls per frame. |
| [WebGPU Timing Performance](https://webgpufundamentals.org/webgpu/lessons/webgpu-timing.html) and [Chrome 121 WebGPU timestamp queries](https://developer.chrome.com/blog/new-in-webgpu-121) | Timestamp queries work through pass `timestampWrites`, resolve to a `QUERY_RESOLVE|COPY_SRC` buffer, then copy to `MAP_READ|COPY_DST`. Chrome may quantize timestamps unless developer features are enabled. | The existing pool is architecturally right. Use it for coarse production labels and add CPU-side performance marks because GPU timestamps do not capture all browser validation/encoding overhead. |
| [GPUBuffer.mapAsync API reference](https://gpuweb.github.io/types/interfaces/GPUBuffer.html) | Mapping resolution only means that buffer is mapped; it does not imply unrelated work is done. `onSubmittedWorkDone()` has stronger queue semantics. | Keep map/readback out of interactive frames. Existing delayed timer readback is good; luma `Buffer.readAsync()` remains acceptable only for offline/readback APIs. |
| [WebGPU Copying Data](https://webgpufundamentals.org/webgpu/lessons/webgpu-copying-data.html) | Texture-buffer copies require 256-byte `bytesPerRow`; mappable buffers are restricted to staging-style usage in WebGPU v1. | The compute sync pass is the right fix for packed position storage. Future CPU readbacks should use explicit staging rings, not map render/storage buffers directly. |
| [WebGPU Storage Buffers](https://webgpufundamentals.org/webgpu/lessons/webgpu-storage-buffers.html) | `@builtin(instance_index)` can index runtime-sized storage arrays in a single instanced draw. | Finish the architectural move from many per-instance vertex buffers toward packed point/link metadata storage buffers, but validate because a previous line precompute variant regressed. |
| [WebGPU Indirect Draw best practices](https://toji.dev/webgpu-best-practices/indirect-draws.html) | Put indirect args in one buffer; many separate indirect buffers can trigger hidden validation dispatches on some backends, and those may not appear in pass timestamps. | Use one shared `INDIRECT|STORAGE` args buffer for points/links/impostors. Do not build many tiny indirect buffers. Add CPU marks around encoding because pass timestamps can miss hidden indirect validation work. |
| [Dawn multi-draw-indirect feature note](https://dawn.googlesource.com/dawn/+/HEAD/docs/dawn/features/multi_draw_indirect.md) | Native Dawn has a multi-draw feature to avoid CPU loops, but standard WebGPU `drawIndirect` issues one draw at a time. | Browser Kajillion should plan around one indirect draw per class for now. Do not design a many-bucket renderer that depends on web-exposed multi-draw. |
| [WebGPU dispatch overhead characterization, arXiv 2604.02344](https://arxiv.org/abs/2604.02344) | Recent measurements report tens of microseconds per WebGPU operation/dispatch on Vulkan/Metal, with fusion important for dispatch-heavy workloads. | A dozen small passes are not free even when each GPU kernel is tiny. Merge or skip clear/resolve/helper passes when their work is below their dispatch overhead and barrier cost. |
| [Chrome 146 transient attachments](https://developer.chrome.com/blog/new-in-webgpu-146) | Transient/memoryless attachments can keep pass-local attachment data in tile memory on supported backends. | Kajillion's MSAA `storeOp: 'discard'` direction is correct. If web-exposed `GPUTextureUsage.TRANSIENT_ATTACHMENT` is available in target browsers, test it for MSAA and short-lived FBOs. |

## Findings

### 1. Production pass shape should not equal profiling pass shape

`renderFrame()` currently uses separate non-MSAA canvas passes for links and points so `timestampWrites` can label `render.lines` and `render.points` independently. The MSAA path already proves the opposite production shape: one canvas pass for all content, one resolve, one timestamp label (`render.canvas`).

For frame pacing, the production default should be a single canvas pass whenever fine-grained GPU timings are disabled. The split pass is valuable during investigation, but it pays extra pass begin/end, attachment load/store, luma wrapper, and timestamp bookkeeping cost in normal use.

Micro-project outcome: add `canvasPassMode: 'auto' | 'combined' | 'split-for-timing'`, default `auto`. In `auto`, use combined when `enableGpuTimings` is false and split when true. Record before/after p50/p95 wall frame time and `render.canvas` GPU time at 100k, 250k, 500k with `msaa=1`.

Success criterion: either combined pass reduces p95 by at least 0.3 ms or the project closes with data proving pass split is lost in fill cost. The end state should still make profiling easy without imposing profiling structure on production frames.

### 2. The canvas path still rebinds stable resources every frame

The luma bind-group cache patch prevents repeated `createBindGroup()` for identical binding tuples, but `Points.draw()` and `Lines.draw()` still call `setBindings()` every frame for mostly stable resources. Bind groups do not snapshot buffer contents, so the hot path should bind stable groups once and update buffer contents or dynamic offsets.

Micro-project outcome: instrument `GPUDevice.createBindGroup`, luma `setBindings`, `setPipeline`, and `setBindGroup` counts in the benchmark harness. Then build a raw WebGPU or thin-wrapper point draw path for the common case: no images, no highlighting split, no impostor composite. Keep one bind group alive for positions/status/style/uniform arena and update only uniform bytes.

Success criterion: after warmup, zero `createBindGroup()` calls and no per-frame `setBindings()` for the common point draw. Report CPU encode p50/p95 and GPU pass time versus current luma `Model.draw()`. If GPU time is equal but CPU p95 drops, keep the raw path as the production fast path. If not, keep only the instrumentation.

### 3. Uniform writes need a frame arena, not many managed stores

Kajillion uses `UniformStore.setUniforms()` across points, lines, force passes, hover passes, and impostor passes. This is readable, but it creates many small host writes and diff/packing calls. WebGPU Fundamentals' large-uniform-buffer pattern applies directly: one 256-byte-aligned buffer, many fixed regions, one or few writes.

Micro-project outcome: create `WebGpuFrameUniformArena` with 3-frame ringed `UNIFORM|COPY_DST` buffers. Allocate fixed offsets for graph, point vertex, point fragment, line vertex, line fragment, force-link, force-many-body, impostor tile, and hover uniforms. Bind groups use static buffer+offset entries or dynamic offsets where practical.

Success criterion: reduce per-frame uniform write calls by at least 70% in `benchmarks` render-only mode. Report JS frame time p95 and command encoding time with `performance.mark()`. This is a CPU-jitter project; do not claim GPU-time wins unless timestamps move.

### 4. Timestamp profiling should add CPU spans and hidden-overhead counters

The existing WebGPU timer pool is good: it defers mapping, uses staging buffers, and supports compute/render passes. The gap is that pass timestamps can miss CPU-side command encoding and some hidden backend validation work, especially around indirect draws.

Micro-project outcome: add a `FramePacingProfiler` that records:

- CPU spans: `hover`, `simulation.encode`, `sync.encode`, `canvas.encode`, `submit`.
- WebGPU object churn counters: `createBindGroup`, `createRenderPipeline`, `createComputePipeline`, `createBuffer`, `createTexture`.
- Pass count: render, compute, raw render, raw compute.
- GPU timestamp snapshot, when available.

Success criterion: benchmark JSON includes CPU p50/p95/maximum for encode and submit-adjacent spans. This becomes the gate for all other hot-path projects: no optimization lands without showing GPU time, CPU encode time, pass count, and object churn.

### 5. Storage-buffer vertex pulling should move to metadata, not another precompute pass

The big Apple TBDR win was avoiding vertex-stage texture sampling for positions. The next storage-buffer opportunity is not the reverted line precompute path; that added work and regressed. The narrower project is to pack immutable per-instance metadata so point and line shaders use `instance_index` to fetch style/endpoint/index records from storage buffers.

For points, a `PointStyle` storage buffer can replace the per-instance vertex buffers for size, color, shape, image index, and image size. For lines, a `LinkStyle` buffer can replace pointA, pointB, color, width, arrow, and link index vertex buffers. The existing quad/curve geometry vertex buffer remains.

Micro-project outcome: implement an opt-in raw point renderer using:

- one quad vertex buffer,
- one `positions` storage buffer,
- one `pointStatus` storage buffer,
- one `PointStyle` storage buffer,
- one frame uniform buffer,
- `draw(4, pointCount)`.

Success criterion: compare against current point draw with identical WGSL output at 100k/250k/500k. Keep only if GPU time or CPU encode p95 improves by at least 5%, or if it enables render bundles/indirect draws cleanly. Do not repeat the line compute-prepass experiment unless the benchmark target changes.

### 6. Indirect draws are useful for GPU-generated counts, not for reducing today's draw count

Kajillion already draws points and links in one draw each in the common canvas path. Switching those fixed draws to indirect does not by itself reduce draw calls. The value is enabling GPU culling/LOD/compaction to write visible instance counts without CPU readback, and enabling render bundles with variable counts.

WebGPU exposes `drawIndirect()` and `drawIndexedIndirect()`, but not standard multi-draw in browsers. Dawn has a native multi-draw feature, but that does not make it a portable web target. Toji's indirect guidance also warns that many separate indirect buffers can cause hidden validation dispatches.

Micro-project outcome: create one `DrawArgsBuffer` with fixed offsets:

- point exact args,
- link exact args,
- point impostor args,
- compacted anchor args.

Compute passes write counts into this shared `INDIRECT|STORAGE|COPY_DST` buffer. Render code uses `drawIndirect(args, offset)`. Keep all args in one buffer.

Success criterion: no CPU readback for visible counts, no extra per-frame indirect buffer allocations, and CPU marks show no hidden overhead spike. The first target should be the point LOD/culling path, not many draw buckets.

### 7. Render bundles are a follow-on to stable bind groups and indirect counts

The repo docs mention render bundles, but current source has no `executeBundles`/`beginRenderBundle` path. Bundles should not be built first. They become valuable after resources are stable and counts can be indirect.

Micro-project outcome: prototype a bundled canvas fast path for the static structure:

- bundle records point draw state and line draw state,
- resource contents update each frame through uniform/storage buffers,
- draw counts come from direct fixed counts initially, then indirect args in the next project.

Success criterion: measure CPU encode p95 only. If current canvas encode is already below 0.2 ms, do not keep bundle complexity. If it drops p95 materially on lower-end hardware, keep it behind `experimentalRenderBundles`.

### 8. Raw WebGPU should be a surgical escape hatch with parity tests

The raw benchmark (`benchmarks/raw-webgpu-100k.html`) shows native WebGPU can draw simple instanced point quads cheaply: earlier docs recorded about 1.245 ms at 100k and 3.473 ms at 1M for the minimal point case. Current Kajillion render cost includes links, richer shaders, blending, LOD, and luma overhead, so the raw number is a lower bound, not a direct accusation.

Micro-project outcome: build `benchmarks/raw-kajillion-point-path.html` that reuses Kajillion's current point WGSL and buffers but bypasses luma `Model`. This isolates abstraction overhead from shader/fill cost.

Success criterion: produce a table:

| Path | GPU point pass | CPU encode p95 | createBindGroup/frame | visual parity |
|---|---:|---:|---:|---|
| luma Model | | | | |
| raw WebGPU | | | | |

Keep raw code only if it improves CPU p95 or GPU time enough to justify duplicated pipeline code. Otherwise, keep the benchmark as a regression sentinel.

### 9. Clear/resolve helper passes should be audited with a dispatch-cost floor

Impostor rendering currently uses separate compute passes for clear, bin, resolve, and optional anchor clear/fill. Force-many-body still has a multi-pass quadtree build even though force sampling is compute. Recent dispatch-overhead measurements make small helper passes suspect when their GPU work is tiny.

Micro-project outcome: add pass-count and per-pass timestamps for:

- `impostor.tiles.clear`,
- `impostor.tiles.bin`,
- `impostor.tiles.resolve`,
- `impostor.anchors.clear`,
- `impostor.anchors.fill`,
- each quadtree build level or a grouped `force.quadtree.build.levels`.

Then test two concrete reductions:

- Epoch-based tile clearing: add an epoch field to tile records and stop clearing untouched tiles every frame.
- Quadtree low-level grouping: merge the smallest levels or move them to one compute buffer build path.

Success criterion: remove at least one pass from an active high-node frame without increasing GPU time. If a clear pass is below measurement noise and merged code increases shader complexity, close it as not worth it.

### 10. CPU hover fallback avoids sync but can become its own frame-pacing problem

WebGPU hover avoids immediate `readPixels`, which is correct for sync avoidance. But link hover on CPU loops over all links after using the async point snapshot. At 1M-scale graphs, that can create main-thread spikes even though the GPU is clean.

Micro-project outcome: extend the existing CPU point picker grid to links, or disable CPU link hover above a threshold unless a coarse spatial index is available. Build link buckets from the best-known point snapshot and graph links; query only buckets near the mouse.

Success criterion: hover detection p95 under 1 ms at 100k and under 3 ms at 500k with link hovering enabled. This project is hot-path cleanup because it protects frame pacing from replacing GPU sync with O(E) CPU work.

## Ranked Implementation Batch

1. **FramePacingProfiler**: CPU spans + object churn + pass counts in benchmark JSON. Outcome: every later project has a real acceptance gate.
2. **Combined production canvas pass**: separate production frame shape from timestamp-debug frame shape. Outcome: lower pass/load-store jitter or a data-backed closure.
3. **Stable bind groups / raw point fast path**: remove per-frame `setBindings()` for the common point draw. Outcome: classify luma overhead and potentially ship raw point renderer.
4. **Frame uniform arena**: replace many tiny uniform writes with one ringed buffer upload. Outcome: lower CPU encode p95.
5. **Shared indirect args buffer**: enable GPU-generated visible counts and future render bundles without readback. Outcome: a foundation for exact GPU culling/LOD.
6. **Metadata storage-buffer point renderer**: replace per-instance vertex buffers with `PointStyle` storage pulling. Outcome: fewer vertex buffer binds and cleaner raw/bundled path.

## Benchmarks To Run For Every Micro-Project

Use AC power, Low Power Mode disabled, same viewport/DPR/seed/data generator.

- `n=100k`, `250k`, `500k`, `useWebGPU=1`, `nosim=1`, `repeat=5`.
- Repeat with simulation on for projects that touch sync, force, or impostor passes.
- Capture wall FPS, CPU frame p50/p95/max, GPU pass timings, render/compute pass counts, createBindGroup/createBuffer/createTexture counts, and visual parity screenshot.
- For timestamp-query work, record whether Chrome developer features are enabled because timestamp quantization can hide sub-100us changes.

## Non-Goals / Closed Loops

- Do not re-run the old line precompute project as-is. Prior notes say it regressed wall-clock. A packed metadata buffer is a different, narrower experiment.
- Do not depend on browser-exposed multi-draw indirect. Plan for one indirect draw per render class.
- Do not optimize for per-pass timestamp detail in production. Production wants stable frame pacing; profiling mode wants visibility.
- Do not map GPU resources used by the hot path. Use staging rings and delayed readback only.
