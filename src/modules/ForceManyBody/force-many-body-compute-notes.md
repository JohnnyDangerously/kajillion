# Force Many Body Compute Shader Notes

WebGPU compute-shader port of `force.repulsion` using Barnes-Hut.

The fragment-shader version (`force-level.wgsl`) costs roughly 6.5-9.5 ms
total at n=100k on M5 Max across 14 sequential render passes, one per
quadtree level, each writing into the same `velocityFbo` via additive blend.
The per-pass cost is dominated by rasterizer / tile-binner setup and blend
pipeline state changes. The per-texel math is comparatively small.

This shader collapses the 14 passes into one compute dispatch:

- 1 thread per point, dispatched as `ceil(N / 8)²`.
- All `MAX_LEVELS` quadtree level textures are bound simultaneously.
- The outer level loop runs in registers.
- The inner 12 x 4 cell iteration samples the current level texture through a
  generated `switch`.
- Velocity accumulates in registers and is written once at the end.
- Final centermass plus random-jitter step is folded into the same dispatch.

`MAX_LEVELS` is a compile-time constant baked at shader-compile time. The host
recompiles when `levels` changes by destroying the pipeline in `create()`, which
matches the force-spring max-links template pattern.

The host always binds `MAX_LEVELS` texture slots. When the actual level count is
lower than `MAX_LEVELS`, the unused tail slots are bound to a placeholder
texture (`positionsTexture`) and never sampled because the loop bound is
`force.levels`.
