# 2026-05-13 — WebGPU sim correctness: positions never move

Surface: while baking a settled headline-scale demo (1M nodes), every bake
came out as the exact initial random scatter produced by `generateBA`,
regardless of how long the simulation was given to run.

## What I confirmed

1. **Position storage buffer (`positionStorageBuffer`)**: holds the
   initial seed values from `data.pointPositions` for the entire life
   of the graph. Never updated. Verified via `readbackPointPositions()`
   returning identical values across a 10-second observation window
   while `progress` ticked 0 → 1 and `isSimulationRunning` flipped true
   → false. First 4 floats: `[1095.77, 2820.30, 1860.49, 1795.89]` for
   `seed=42`. Same numbers `generateBA` produces.
2. **Position textures (`currentPositionTexture`, `previousPositionTexture`)**:
   contain ALL ZEROS. Read directly via `copyTextureToBuffer` with both
   raw and 256-aligned `bytesPerRow`. Same result.
3. **Velocity texture (`velocityTexture`)**: also ALL ZEROS.
4. **Direct `device.handle.queue.writeTexture(...)` into
   `currentPositionTexture`**: also fails. Wrote a known test pattern,
   read back zeros. So the issue isn't luma.gl's wrapper — it's at the
   raw WebGPU level.
5. **Visible rendered canvas**: shows the initial scatter cloud (because
   the vertex shader reads from `positionStorageBuffer`, which is
   seeded via the SEPARATE `buffer.write()` path that DOES work).

## Why this wasn't caught earlier

- The bench timer outputs are real GPU work happening (force.repulsion =
  0.77 ms, etc.). The force compute runs, just on zero-valued input. So
  the bench numbers passed inspection — but they're measuring meaningless
  computation.
- The visible canvas shows the initial scatter, which looks "graph-like"
  enough at a glance (a square cloud of points) that it was mistaken for
  "the sim hasn't quite settled yet" rather than "the sim never moved."
- Every screenshot taken this multi-day perf grind showed the same uniform
  square cloud. It was the same cloud — initial state — every time.

## The likely chain

1. luma.gl's `Texture.copyImageData(...)` calls `device.queue.writeTexture(...)`.
2. For `rgba32float` textures something about the device or texture
   configuration causes the write to silently no-op. Possibly an unmet
   feature requirement (`float32-filterable` is gated behind a feature),
   possibly an alignment issue luma.gl isn't surfacing, possibly a
   Dawn-on-Apple quirk. Need to test on a known-good WebGPU
   `rgba32float` example to isolate.
3. With textures stuck at zero, every sim step's input is zero. Force
   compute on zero input produces zero output. `updatePosition` adds
   zero to zero. Forever.
4. Independently: `syncPositionStorageBuffer` needs `COPY_SRC` on the
   textures (commit `f5cca35` adds it) AND needs `bytesPerRow` aligned
   to 256 (currently `width * 16` which is NOT aligned at common sizes
   like 317×16=5072). So even if textures had real data, sync to the
   buffer would fail. The buffer's initial seed has masked this for
   the entire WebGPU port.

## What to investigate next session

1. Build a minimal WebGPU `rgba32float` writeTexture test. If a clean
   2×2 texture written + read back works, isolate what differs in the
   kajillion path. If it doesn't, the device is missing a feature.
2. Check `device.features` for `float32-filterable`. The texture is
   sampled (`textureSampleLevel`), not just storage-bound, so it likely
   needs this feature flag during `requestDevice`.
3. Either way: after fixing the seed, fix `syncPositionStorageBuffer`'s
   `bytesPerRow` to 256-align and decode accordingly on the CPU side
   (or repack the buffer layout).
4. Then re-test: settled positions should produce a visible
   force-directed graph (clusters around hubs, not a uniform square).
   That visible result becomes the real first headline screenshot the
   engine has ever earned.

## What this session shipped despite the bug

- **Bench timing infrastructure** is real — measures GPU submit cost
  even though the GPU output is meaningless. The framework is sound;
  the workload it benchmarks isn't.
- **Demo measurement page** (record button, overlay) works.
- **Pre-bake pipeline** (bake endpoint, binary format, load button) works
  mechanically. The content it bakes today is the initial scatter, not a
  settled graph.
- **The 1M static asset** that ships in `demo/public/baked-1m.bin` is
  technically `generateBA(1_000_000, 3, 42)` initial positions — a
  uniform random square. It proves "1M points loadable + renderable in
  the browser" but does NOT prove "force-directed at scale." That second
  claim awaits the writeTexture fix.

## Commit trail this session

- `f5cca35` — fix(webgpu): COPY_SRC usage on position textures (scaffold)
- `e1dc63a` — fix(demo bake): start(1) before settle-wait (still useful)
- `489f264` — demo: dropdown 500k/1M + bake instructions
- `e50466e` — demo: pre-bake pipeline (mechanism)
- `91928ed` — feat(webgpu): async readback for settled point positions (mechanism is correct; data it reads is stuck at initial seed)

Honest summary: the perf-grind commits (point-shader fast paths,
pointStatus storage buffer, etc.) optimize a sim path that has been
fundamentally broken since the WebGPU port. Their MICROBENCH numbers
are real; their REAL-FRAME impact requires the sim to work first.
