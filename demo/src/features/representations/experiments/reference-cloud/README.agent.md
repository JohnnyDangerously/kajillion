# reference-cloud

Purpose: isolated beauty-mode renderer for the dense 2.5D reference-cloud graph.

This island owns its canvas overlay and should not change core WebGPU rendering.
Use `?rep=reference-cloud` to activate it.

Keep the representation self-contained:

- `layout.ts` generates the central cloud, satellites, tendrils, bridge nodes, and debug metrics.
- `project.ts` applies the perspective camera.
- `render.ts` draws faint edges and depth-sorted shaded point sprites.
- `overlay.ts` owns DOM lifecycle, resize, pan, and wheel zoom.

Visual contract:

- black background
- one dense connected cloud, not horizontal cluster islands
- heavy-tailed node sizes
- shaded/rimmed particles
- faint inter-cluster connective tissue
- categorical colors mixed in the core
