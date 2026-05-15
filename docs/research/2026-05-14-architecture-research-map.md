# Kajillion Rendering Architecture Research Map

Date: 2026-05-14

This document states the architecture we want to follow before implementation projects are split out. The research tracks below are intended to produce investment decisions, not generic task lists.

## 1. Hot Path Cleanup Architecture

Kajillion should treat the render loop as a bounded, low-jitter GPU pipeline.

The architecture is:

- Persistent GPU resources: allocate buffers, bind groups, pipeline layouts, and render targets outside the frame loop whenever possible.
- Stable pass structure: minimize render/compute pass count and avoid extra compute-to-render barriers unless a pass removes more work than it adds.
- Explicit resource lifetime: use buffer pools and ring buffers for transient data; avoid reallocation, remapping, and bind-group churn.
- Zero readback in interactive frames: GPU timing and picking must be async or delayed; no hot-frame CPU waits.
- Raw WebGPU escape hatch: where luma abstractions block indirect draws, exact pass control, or low-jitter resource reuse, use direct WebGPU wrappers in isolated hot-path modules.
- Pass-level instrumentation: every optimization must report GPU time, visible count, and frame-time percentile impact.

Outcome standard: each hot-path project should remove a measurable source of jitter, pass overhead, allocation churn, or CPU/GPU synchronization.

## 2. GPU-Driven Exact Rendering Architecture

Exact rendering is the hero path until a replacement is both faster and visually indistinguishable.

The architecture is:

- GPU-resident source buffers for node positions, colors, sizes, status, and edge endpoints.
- Compute-generated visibility/importance lists for nodes and edges.
- Compact visible work on the GPU; draw only work that can affect pixels.
- Use indirect draws where WebGPU/luma support is adequate; otherwise render fixed-capacity compacted buffers without CPU readback.
- Separate node and edge policies. Nodes should remain exact longer; edges should reduce earlier and more aggressively.
- Screen-size detail tiers should remove subpixel detail, not replace visible structure.

Outcome standard: each exact-rendering project should preserve exact visual output at common zooms while lowering rendered work, pass time, or frame variance.

## 3. Perceptual Multipliers Architecture

Kajillion should create the perception of massive detail without always paying linear cost.

The architecture is:

- Preserve what the eye counts: silhouette, color variance, hubs, boundaries, local irregularity, and stable motion.
- Use stable stochastic selection, not frame-dependent random choices.
- Prefer blue-noise/dithered transitions and hysteresis over hard LOD switches.
- Use procedural micro-impostors only when they create plausible local detail and do not erase real structure.
- Treat density fields as support layers, not the primary visual truth.
- Every approximation must be compared against exact during camera motion, not only as a static screenshot.

Outcome standard: each perceptual project should increase perceived detail per rendered primitive while staying hard to identify during pan/zoom.

## 4. Beauty-First Rendering Architecture

The product goal is not “many dots”; it is an impossible-looking, readable graph object.

The architecture is:

- Render clusters as colored, structured communities, not white washed-out blobs.
- Edge rendering should reveal flow and relation patterns without becoming a hairball.
- Labels must be sparse, stable, hierarchy-aware, and anchored to real graph structure.
- Blend, tone mapping, bloom-like cores, and dark/light themes should be designed as visual systems, not incidental shader constants.
- Alternate views such as hive plots, bundled lanes, or cluster summaries are allowed when they preserve truth at overview scale.

Outcome standard: each beauty project should make the graph more legible or more striking while maintaining performance and avoiding misleading visual artifacts.

## Research Rounds

Round 1: collect serious WebGPU/GPU rendering and graph-visualization references for the four architectures.

Round 2: turn references into candidate micro-projects, each with a measurable outcome.

Round 3: rank projects by expected display ROI: visual quality gained per GPU millisecond, implementation risk, and benchmarkability.

Round 4: choose the first implementation batch and write benchmark criteria before coding.

## Initial Source Leads

- WebGPU bind group and pipeline reuse: https://toji.dev/webgpu-best-practices/bind-groups.html
- WebGPU timestamp profiling: https://toji.dev/webgpu-profiling/timestamp-queries.html
- WebGPU timing caveats: https://webgpufundamentals.org/webgpu/lessons/webgpu-timing.html
- WebGPU optimization patterns: https://webgpufundamentals.org/webgpu/lessons/webgpu-optimization.html
- WebGPU indirect draw feature constraints: https://www.w3.org/TR/2023/WD-webgpu-20230302/
- GPU compute culling reference pattern: https://www.threejs-blocks.com/docs/ComputeInstanceCulling
- Prefix-sum/scan for GPU compaction: https://yayo1.com/en/blog/webgpu-prefix-sum/
- Spatiotemporal blue noise: https://research.nvidia.com/publication/2021-12_scalar-spatiotemporal-blue-noise-masks
- NVIDIA blue-noise rendering discussion: https://developer.nvidia.com/blog/rendering-in-real-time-with-spatiotemporal-blue-noise-textures-part-2/
- Edge bundling evaluation: https://www.mdpi.com/1099-4300/20/9/625
- Edge bundling survey: https://www.sciopen.com/article/10.1109/TST.2013.6509098
- Ordered bundles: https://arxiv.org/abs/1209.4227
- Multilevel agglomerative edge bundling: https://yifanhu.net/PUB/edge_bundling.pdf
- High-quality point-based rendering: https://graphics.rwth-aachen.de/media/papers/point_rendering1.pdf
