# 2026-05-14 - Research Track 2: GPU-Driven Exact Rendering

Goal: find techniques that keep Kajillion's primitive renderer exact, or
near-exact with explicit bounded visual loss, while reducing `render.canvas`
cost for 50k-1M node graphs.

## Local Context

Kajillion already has the right foundation for a GPU-driven path:

- Points render as WebGPU instanced quads in `src/modules/Points/draw-points.wgsl`.
  Positions and point status are vertex-pulled from storage buffers, avoiding
  the old vertex-stage texture sampling problem.
- Lines render as instanced ribbons in `src/modules/Lines/draw-curve-line.wgsl`.
  Endpoints are pulled from the point position storage buffer.
- Current frustum and screen-size culling happens inside vertex shaders by
  moving rejected instances offscreen. This saves fragments but still pays the
  draw's instance and vertex invocation cost.
- `renderLodMode: 'exact'` disables stochastic LOD strength, but defaults still
  include `pointMinPixelSize: 0.5` and `linkMinPixelLength: 0.5`. That is
  near-exact, not mathematically exact.
- luma.gl 9.2.6 has WebGPU compute `dispatchIndirect`, but its WebGPU render
  pass `drawIndirect()` is currently a stub. True render-side indirect draws
  need either a local luma patch or a raw `GPURenderPassEncoder` escape hatch.
- Existing tile impostor and hybrid-anchor code is useful for perceptual
  overview modes, but it is not the exact-rendering answer.

The main conclusion: the next high-leverage step is not another shader-side
offscreen skip. It is GPU visible-list construction plus indirect drawing, with
stable compaction where alpha blending order matters.

## Source Notes

- WebGPU supports render indirect calls through `drawIndirect()` and
  `drawIndexedIndirect()`, with argument buffers carrying vertex/instance
  counts and offsets. MDN documents the 16-byte non-indexed layout:
  `[vertexCount, instanceCount, firstVertex, firstInstance]`.
  Source: <https://developer.mozilla.org/en-US/docs/Web/API/GPURenderPassEncoder/drawIndirect>
- WebGPU supports indirect compute dispatch with a 12-byte
  `[x, y, z]` workgroup-count buffer.
  Source: <https://developer.mozilla.org/en-US/docs/Web/API/GPUComputePassEncoder/dispatchWorkgroupsIndirect>
- WebGPU core exposes single indirect draw calls, not a Vulkan-style
  `vkCmdDrawIndirectCount` or browser-portable multi-draw-indirect loop.
  Dawn has a native `multiDrawIndirect` feature document, but that is not a
  portable WebGPU baseline.
  Source: <https://dawn.googlesource.com/dawn/+/HEAD/docs/dawn/features/multi_draw_indirect.md>
- WebGPU copy-to-buffer rows have 256-byte alignment constraints, which matches
  the bug Kajillion already worked around with compute texture-to-storage sync.
  Source: <https://www.w3.org/TR/webgpu/#dom-gpuimagecopybufferlayout-bytesperrow>
- WGSL storage layout alignment matters. The spec's alignment/size rules are
  the reason Kajillion's current line instance struct is padded to vec4 slots.
  Source: <https://www.w3.org/TR/WGSL/#alignment-and-size>
- Parallel prefix scan is the standard building block for GPU stream
  compaction. GPU Gems 3 chapter 39 is still the clean reference for
  work-efficient scan and hierarchical block scans.
  Source: <https://developer.nvidia.com/gpugems/gpugems3/part-vi-gpu-computing/chapter-39-parallel-prefix-sum-scan-cuda>
- WebGPU limit defaults matter for 1M-scale buffers. `maxStorageBufferBindingSize`
  and `maxBufferSize` decide whether a single packed all-edge instance buffer is
  legal.
  Source: <https://developer.mozilla.org/en-US/docs/Web/API/GPUSupportedLimits>
- Point-cloud WebGPU work points in the same direction: spatial ordering and
  compute-driven culling/raster preparation are central once primitive count
  gets high.
  Source: <https://arxiv.org/abs/2104.07526>

## Exact vs Near-Exact

Use three labels consistently:

- **Exact:** culls only primitives guaranteed not to affect the framebuffer.
  Offscreen point sprites and offscreen edge bounding boxes qualify. A point or
  edge inside the viewport is still drawn, even if subpixel.
- **Conservative exact:** may keep extra invisible work but never drops visible
  output. Example: edge AABB based on endpoint/control-point bounds plus a fat
  width margin.
- **Near-exact:** may drop primitives below a perceptual threshold. Current
  `pointMinPixelSize` and `linkMinPixelLength` are in this category. They are
  reasonable for overview performance, but exact mode should either force them
  to `0` or explicitly report that exactness is thresholded.

For Kajillion, the default can remain visually pragmatic, but benchmark labels
should distinguish `exact-strict` from `exact-thresholded`.

## Technique Findings

### 1. GPU Frustum Culling

Current shader culling is useful but late. The GPU still launches all instances.
Move culling into a compute classify/compact pass:

- For each point, project center to clip space, compute sprite radius using the
  actual point size/image size/outline state, and mark visible if the sprite
  AABB intersects the viewport.
- For each edge, project endpoints and the curve control point. Build a
  conservative screen-space AABB expanded by line width, smoothing, hover/focus
  width, and arrow length. Cull only if that AABB misses the viewport.
- For straight links, a same-side endpoint reject is cheap but incomplete.
  AABB culling is still conservative and catches more panned-offscreen work.
- For curved links, do not cull from endpoint chord length only; the control
  point can bend into view.

Implication for Kajillion: keep current vertex culling as a fallback, but make
the hot path feed only visible point/edge IDs to the draw. This saves vertex
work and can reduce line ribbon setup before rasterization starts.

### 2. Screen-Size Culling

Screen-size culling is not exact unless the threshold is zero. It can be
near-exact if the threshold is below a defensible device-pixel bound, but it
can still remove additive density signal in galaxy zooms.

Recommendations:

- `renderLodMode: 'exact'` should probably set effective
  `pointMinPixelSize = 0` and `linkMinPixelLength = 0`, unless the mode is
  renamed or surfaced as thresholded exact.
- Add a separate `renderLodMode: 'exact-thresholded'` or metric label if the
  default 0.5 thresholds remain active.
- For links, projected-length culling should use screen-space control-polygon
  length for curves, not just endpoint distance.
- For additive link blending, be especially cautious: many subpixel links can
  be invisible individually but visible in aggregate.

Implication for Kajillion: screen-size culling is a good performance knob, but
it should not be the headline answer for "exact rendering without quality loss."

### 3. Prefix-Sum Compaction

Two compaction choices:

- **Atomic append:** one classify pass does `idx = atomicAdd(count, 1)` and
  writes `visibleIds[idx] = sourceId`. Fast, simple, unordered.
- **Prefix-sum scan:** classify flags, scan flags, scatter survivors to
  `visibleIds[prefix]`. More passes, stable input order.

Stable order matters because normal alpha blending is order-dependent. Links
default to additive blending, where order is effectively irrelevant. Points use
premultiplied alpha-over, so exact image matching should use prefix-sum
compaction or preserve order some other way.

Recommended split:

- Use prefix-sum compaction for points in strict exact mode.
- Use atomic append for additive links and for performance experiments.
- Add an A/B screenshot diff test for atomic vs prefix point order before
  deciding whether unordered point compaction is visually acceptable.

Micro-architecture:

1. `classifyPoints`: writes `flags[i]` and optionally projected radius.
2. `scanFlags`: hierarchical scan over `flags`.
3. `scatterVisiblePoints`: writes `visiblePointIds[prefix[i]] = i`.
4. `writePointIndirectArgs`: writes `[4, visibleCount, 0, 0]`.

For lines, same pattern, but `vertexCount` is the line ribbon geometry vertex
count and `instanceCount` is visible edge count.

### 4. Indirect Draws

The ideal WebGPU call is one indirect point draw and one indirect line draw per
visible pass:

- Point args: `vertexCount = 4`, `instanceCount = visiblePointCount`,
  `firstVertex = 0`, `firstInstance = 0`.
- Line args: `vertexCount = curveLineGeometry.length`,
  `instanceCount = visibleEdgeCount`, `firstVertex = 0`,
  `firstInstance = 0`.

The point/line vertex shaders then use:

```wgsl
let pointId = visiblePointIds[instanceIdx];
let edgeId = visibleEdgeIds[instanceIdx];
```

and fetch attributes from storage buffers by original ID.

Repo constraint: luma.gl's WebGPU render-pass indirect method is not implemented
in 9.2.6. Before building compaction, do a small luma patch or escape hatch
spike. Otherwise the renderer can build perfect visible lists but still cannot
consume the GPU-produced count without a CPU readback.

### 5. Multi-Draw Alternatives In WebGPU

Portable WebGPU does not give Kajillion a browser-safe multi-draw-indirect-count
path today. Fortunately, Kajillion does not need one for the immediate target:
there are only a few material buckets.

Practical alternatives:

- One indirect draw for exact points.
- One indirect draw for visible links.
- If style buckets are needed, run a fixed small CPU loop over buckets and call
  `drawIndirect(argsBuffer, bucketOffset)`. This does not read counts back to
  the CPU.
- Avoid per-tile draw loops unless tile count is tiny. A CPU loop over hundreds
  of tiles gives back the driver overhead that GPU-driven rendering is meant to
  remove.

### 6. Visible Edge Compaction

Visible edge compaction should replace the current "draw every edge and
degenerate offscreen ones" behavior.

Data needed per edge:

- `edgeEndpoints: array<vec2<u32>>`, direct point IDs. This is better than
  storing texture-coordinate floats for the WebGPU render path.
- `edgeColor`, `edgeWidth`, `edgeFlags` storage buffers.
- Optional `visibleEdgeIds` plus optional `edgeAabbPx` for picking.

The existing `precompute-line-instances.compute.wgsl.ts` writes an 80-byte
`LineInstance` for every edge. At 3M edges, that would be roughly 240 MB before
padding and limits. For 1M-node BA-style graphs, a visible-ID list is a safer
first step than precomputing fat structs for every edge.

Best first version:

- Classify and compact visible edge IDs.
- Keep line vertex shader doing endpoint/control/width math for visible edges
  only.
- Add a later optional precompute pass for visible edges only if profiling says
  vertex math remains dominant.

### 7. Storage Buffer Layouts

Current `array<vec4<f32>>` positions are convenient because they mirror
`rgba32float` textures, but render bandwidth can be lower:

- Add a render-only `array<vec2<f32>>` position buffer during the texture sync
  pass. Keep the existing vec4 buffer only where other modules still require it.
- Store endpoint IDs as `vec2<u32>`, not float texture coordinates. It removes
  `pointsTextureSize` math in the line shader and makes compaction/indexing
  clearer.
- Keep hot render attributes in separate SoA buffers: position, size, color,
  shape/image flags, status. SoA works well with visible-ID indirection because
  shaders fetch only fields they need.
- Be careful with `array<struct>` padding. WGSL vec3/vec4 alignment can silently
  inflate buffers. For 1M-3M instances, a few wasted vec4 slots become tens or
  hundreds of MB.
- Request and log WebGPU limits. A single all-edge precompute buffer may exceed
  default `maxStorageBufferBindingSize`; visible-ID buffers will not.

### 8. Morton/Hilbert Ordering

Spatial ordering helps because visible IDs after pan/zoom tend to cluster in
space, which improves cache locality for position and attribute fetches.

Recommended path:

- For static or baked layouts, compute a Morton code from final world position
  and reorder point render buffers once. Rewrite edge endpoint IDs through the
  permutation.
- Prefer Morton first. Hilbert often has better locality, but Morton is simpler
  to compute, sort, and debug.
- Do not reorder the live simulation buffers every frame. That would disrupt
  more code than it helps. For live simulation, consider a render-only
  permutation after settle or every coarse interval.
- If a GPU sort is later needed, start with fixed-grid binning rather than a
  full general-purpose sort.

Expected benefit: better memory locality in visible-list draws and faster
screen-tile/picking queries. This is a secondary project after indirect
compaction exists; reordering before compaction makes wins harder to isolate.

### 9. Spatial Indexes

For exact rendering, spatial indexes should be conservative accelerators:

- World-grid or screen-grid cells can be culled as whole cells only if the cell
  AABB misses the viewport.
- Cells that intersect the viewport still need per-primitive classification
  unless their whole contents are known visible.
- Existing tile-impostor binning code can inspire screen-grid construction, but
  the exact path should output primitive IDs, not aggregate impostors.

Useful variants:

- **Screen tile bins:** rebuild each frame from projected positions. Good for
  hover/picking and visible point compaction.
- **World grid:** stable under pan/zoom until simulation moves. Good for baked
  layouts and broad-phase frustum culling.
- **Barnes-Hut quadtree reuse:** promising only if the force quadtree exposes
  cell bounds and point ranges in storage-buffer form. Do not couple render
  culling to force internals until layout settles.

### 10. GPU Picking Without Readbacks

"Without readbacks" has two meanings:

- **For visual hover/highlight:** no CPU readback is needed. A compute pass can
  write `hoveredPointId` / `hoveredEdgeId` into a small storage buffer, and draw
  passes can read that buffer to render hover rings or colors.
- **For JS callbacks:** the CPU eventually needs an ID. Make it asynchronous
  and throttled, using a small ring of MAP_READ buffers so hover visuals are not
  blocked by callback latency.

Recommended exact GPU picking path:

1. Reuse visible point/edge lists from compaction.
2. Build or reuse screen-tile bins.
3. On mouse move, scan only the cursor tile plus neighbors in compute.
4. Write nearest point/link ID to `hoverStateBuffer`.
5. Render hover highlight directly from `hoverStateBuffer`.
6. Optionally read back the ID one or two frames later for user callbacks.

This avoids current full-screen picking render/readback pressure and keeps the
interactive visual response GPU-local.

## Prioritized Micro-Projects

### P0 - Indirect Draw Smoke Test

Patch luma or add a raw WebGPU escape hatch for `drawIndirect`.

Outcome:

- A trivial point draw uses a GPU-written indirect args buffer.
- No CPU readback is needed to set instance count.
- This de-risks all later compaction work.

### P1 - Exact Point Visible List

Implement prefix-sum compacted `visiblePointIds` and draw points through
`drawIndirect`.

Outcome:

- Strict exact mode matches current output when `pointMinPixelSize = 0`.
- Thresholded mode matches current output with existing threshold settings.
- Panned/zoomed views reduce point vertex invocations from `N` to `visibleN`.

### P2 - Exact Edge Visible List

Implement conservative edge classification and compacted `visibleEdgeIds`.

Outcome:

- Offscreen links no longer pay full ribbon vertex cost.
- Curved links use conservative AABB bounds, so no visible curves disappear.
- Projected-length culling is separately gated as near-exact.

### P3 - Storage Layout Slimming

Add WebGPU render-only SoA storage buffers:

- `renderPositions: array<vec2<f32>>`
- `edgeEndpoints: array<vec2<u32>>`
- packed or SoA point/edge style buffers

Outcome:

- Lower bandwidth per visible primitive.
- Sim texture compatibility remains intact.
- Easier shaders for visible-ID indirection.

### P4 - GPU Hover State

Move hover determination into compute over visible IDs or cursor tile bins.

Outcome:

- Hover highlight renders from GPU state without CPU readback.
- JS callbacks receive async IDs with known one-frame or two-frame latency.
- Full-screen pick FBO work can be removed or reserved as fallback.

### P5 - Morton Reorder For Baked Layouts

After a layout is settled or loaded from `baked-1m.bin`, build a Morton order
permutation and rewrite render buffers.

Outcome:

- Better locality for visible-list draws and screen-tile binning.
- No impact on live simulation correctness.
- Benchmarkable as a separate switch.

## Risks And Pitfalls

- **Exact mode currently is not strict exact if 0.5px thresholds stay active.**
  Fix naming or force thresholds to zero for strict exact benchmarks.
- **Indirect draw API gap in luma is a blocker.** Do not spend days on visible
  compaction before proving the renderer can consume GPU-produced counts.
- **Alpha blend ordering can change images.** Prefix-sum compaction preserves
  input order; atomic append does not.
- **All-edge fat precompute buffers do not scale to 1M nodes.** Visible-ID
  compaction is safer than an 80-byte struct per edge.
- **Compute pass count matters.** Prefix scan adds dispatches. It is worth it
  only if visible counts are meaningfully lower than total counts or if it
  unlocks downstream picking/buffering wins.
- **WebGPU limits vary by adapter.** Log limits in benchmark JSON before
  allocating large storage or indirect buffers.

## Recommended Next Step

Start with P0 and P1. The smallest credible prototype is:

1. Patch/escape `drawIndirect`.
2. Add point classify + stable compaction.
3. Change the WebGPU point shader to index through `visiblePointIds`.
4. Benchmark exact strict (`pointMinPixelSize = 0`) and thresholded exact
   (`pointMinPixelSize = 0.5`) at 100k, 250k, 500k, and 1M baked.

If P1 does not reduce `render.canvas` in panned or zoomed views, edge compaction
will still likely matter because links dominate high-N frames, but the point
prototype will have validated the GPU-driven rendering plumbing.
