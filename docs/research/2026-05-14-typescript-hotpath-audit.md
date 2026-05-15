# TypeScript Hot-Path Audit

Date: 2026-05-14

## Audit Standard

Kajillion's large-graph WebGPU path should treat TypeScript as orchestration:

- configure graph state and user controls
- upload data on load or explicit data/style changes
- update small uniforms and encode GPU passes per frame
- receive infrequent asynchronous readbacks for APIs, export, or debug

TypeScript should not do per-node or per-edge work in render, simulation, hover, pan/zoom, or other high-frequency interaction paths.

## Verdict

The steady WebGPU render and force-simulation path mostly follows the standard today. Per-node and per-edge draw/simulation work is in WGSL/GPU passes, while TypeScript drives frame pacing, pass setup, uniform updates, and `device.submit()`.

The large-graph WebGPU interaction path now has GPU-backed async routes for hover and selection. The remaining strict-standard gap is API compatibility: the legacy synchronous selection APIs still use CPU fallbacks on WebGPU, while the new async selection APIs use GPU mask passes.

## Green Paths

### Render Loop

`src/index.ts:2521-2657` drives the frame:

- hover check is gated before simulation and render
- force simulation is dispatched through GPU modules
- point position storage is synchronized through a GPU path
- links and points are drawn through GPU render passes
- the frame ends with a single `device.submit()`

There is no per-node or per-edge loop in the central frame render path.

### Simulation Loop

`src/index.ts:2526-2543` throttles simulation and calls GPU force modules. TypeScript updates alpha/tick control and dispatches GPU work; it is not the large-N simulation engine.

### Demo Labels

The demo label overlay loops over a fixed small label set, not all nodes. That is acceptable for the current demo surface.

## Red And Yellow Paths

### Fixed: WebGPU Hover Uses GPU Picking

WebGPU point and link hover now use the existing GPU pick passes plus `readRgba32FloatFramebufferAsync()`.

The implementation keeps at most one point and one link pick readback in flight, consumes the previous completed result in the synchronous hover callback path, and returns a one-frame-deferred hover state instead of scanning nodes or links in TypeScript.

Remaining caveat: this first slice uses small per-hover GPU readbacks and extra submits. It removes O(N/E) TypeScript from hover, but the final production path should coalesce point/link picking into a single interaction scheduler and avoid unnecessary submit churn.

### Fixed Path: WebGPU Async Selection Uses GPU Mask Passes

`findPointsInRectAsync()` and `findPointsInPolygonAsync()` run the existing GPU selection mask passes on WebGPU, submit the pass, and read back the mask with `readRgba32FloatFramebufferAsync()`.

This avoids CPU geometry tests over every point in the product path. Returning an index array still requires decoding the mask on the CPU, which is inherent to delivering a JavaScript array result.

Remaining caveat: the legacy synchronous `findPointsInRect()` and `findPointsInPolygon()` APIs still fall back to CPU on WebGPU because WebGPU readback is asynchronous. Product code should use the async APIs for large graphs. A future GPU bitset/selection-state buffer can keep drag-preview fully GPU-resident and read back only on commit.

### P1: Demo Visual Toggles Rebuild Large Attribute Arrays

`demo/src/main.ts:555-611` recomputes point colors, point sizes, and link colors when visual controls change, then uploads them.

That is fine for explicit control changes, not for animation or per-frame style. Product controls should prefer shader uniforms and small parameter buffers where possible, reserving full attribute rebuilds for true data/style schema changes.

### P2: Per-Frame Command And Binding Churn

The frame path still performs multiple uniform/binding updates and split render passes for timing visibility. This is not per-node TypeScript work, but it can still affect CPU frame time and tail latency.

Outcome target: production render mode should use stable bind groups/uniform arenas, fewer pass splits when timing is disabled, and a bounded command encoding shape.

### P2: Load-Time Setup Is Still TypeScript

Graph generation, force-link adjacency setup, line endpoint buffers, and visual attribute packing are TypeScript setup work. That is acceptable for the current architecture, but it will become a startup/import bottleneck at 1M+ scale.

Outcome target: baked binary layouts, workers/WASM for import preprocessing, or GPU preprocessing for large demos.

## Language Position

The base product language is TypeScript plus WGSL:

- TypeScript is fast enough for orchestration, UI, configuration, setup, benchmarking, and small fixed-size per-frame work.
- WGSL/WebGPU must own large-N rendering, simulation, culling, picking, LOD/binning, and any operation that scales with nodes or edges during interaction.

So the answer is not "TypeScript is too slow." The answer is that TypeScript is acceptable only if large-N work never lands in its hot paths. Today, render/simulation mostly pass that bar; picking/selection do not.

## Audit-Backed Projects

1. Production interaction scheduler: coalesce point/link hover into one latest-pointer GPU pick pipeline.
2. GPU-resident selection state: bitset/flags for preview, read back only on commit.
3. Production render command path: reduce per-frame command/binding churn when timing/debug features are off.
4. Large-data import path: move 1M-scale preprocessing away from main-thread TypeScript.
5. Hot-path profiler: track CPU frame time, hover time, command encoding time, allocations, buffer writes, readbacks, and p95/p99 frame time.
