# Kajillion Research Synthesis And Investment Plan

Date: 2026-05-14

This document synthesizes the four research tracks:

- [Architecture map](./2026-05-14-architecture-research-map.md)
- [Hot path cleanup](./2026-05-14-hot-path-cleanup.md)
- [GPU-driven exact rendering](./2026-05-14-gpu-driven-exact.md)
- [Perceptual multipliers](./2026-05-14-perceptual-multipliers.md)
- [Beauty-first rendering](./2026-05-14-beauty-first-rendering.md)
- [Perceptual scheduling roadmap](./2026-05-14-perceptual-scheduling-roadmap.md)

## Executive Decision

Screen-space tile binning is not the default renderer. It remains a far-overview/perceptual support layer.

The product renderer should be built around:

1. Low-jitter WebGPU hot path.
2. GPU-driven exact rendering with visible-list compaction.
3. Perceptual multipliers that preserve color, silhouette, outliers, and motion stability.
4. Beauty-first visual systems: labels, lanes, tone mapping, cluster terrain, and alternate overview modes.
5. Perceptual scheduling: show the full graph as an immediate impression, then crystallize detail where attention lands.

The investment shape is not "one giant LOD project." It is a set of micro-project outcomes, each independently measurable and either kept or closed.

## Architectural Principles

### Hot Path Principle

The GPU pipeline should be boring, bounded, and repeatable.

Keep resources persistent, reduce pass count, avoid CPU/GPU sync, avoid per-frame bind/resource churn, and use raw WebGPU only where abstraction prevents a measurable optimization.

### Exact First Principle

Exact rendering remains the reference and the hero path until another path is both faster and visually indistinguishable.

Cull and compact invisible work before replacing visible work.

### Perceptual ROI Principle

If we cheat, we cheat where the viewer cannot count. The cheat must preserve the features the eye uses: silhouette, color variance, hub identity, sparse tendrils, boundary irregularity, and stable motion.

### Beauty Is A Rendering Feature

Labels, color systems, lane bundling, and density tone mapping are not decorations. They decide whether a million-node graph feels deliberate or ugly.

### Perceptual Scheduling Principle

LOD changes should be scheduled for moments when the viewer is least likely to
notice them: camera motion, cursor motion, selection ripples, local shimmer, or
semantic attention shifts. When exact detail appears, aggregate density should
dim by a matching perceived luminance so the user experiences sharpening rather
than loading.

## Round 1 Findings

### Hot Path Cleanup

Strongest opportunities:

- Separate production pass shape from profiling pass shape.
- Stop rebinding stable resources every frame.
- Replace many small uniform writes with a frame uniform arena.
- Add CPU spans and object-churn counters beside GPU timestamps.
- Prove or reject raw WebGPU point rendering against luma `Model`.
- Build a shared indirect-args buffer only after a draw-indirect smoke test.

Most underexploited point: Kajillion already made the big vertex texture-sampling fix. The next wins are likely frame pacing and CPU/abstraction overhead, not shader magic.

### GPU-Driven Exact Rendering

Strongest opportunities:

- Patch or bypass luma's missing WebGPU render `drawIndirect`.
- Build exact visible point lists on GPU.
- Build exact visible edge lists on GPU.
- Keep point order stable in strict exact mode with prefix-sum compaction.
- Use atomic append where blend order does not matter, especially additive links.
- Add render-only SoA buffers and endpoint-ID buffers to reduce fetch cost.

Most underexploited point: current vertex-shader culling saves fragments but still pays all instance/vertex work. Visible-list rendering changes the amount of work the GPU launches.

### Perceptual Multipliers

Strongest opportunities:

- Tile moment splats: anisotropic micro-constellations from existing tile variance/covariance.
- Blue-noise hybrid anchors: preserve outliers, silhouettes, minority colors, and hub structure at the same anchor budget.
- Exact/impostor crossfade bands: make transitions gradual and stable.
- Color/silhouette representatives: prevent dense mixed regions from averaging into mud or white.
- Static baked cluster atlases for the eventual 1M demo.

Most underexploited point: the current tile path stores moments but still draws too much like dots/fog. The next perceptual step is using those moments to create plausible local point texture.

### Beauty-First Rendering

Strongest opportunities:

- Beauty preset pipeline for coherent dark/light scenes.
- Stable hierarchical labels.
- Core/aura density composite with bounded tone mapping.
- Soft-lane edge bundling with compatibility gates.
- Cluster terrain layer: dense regions as shaped communities, not fog.
- Hive/lane overview story for typed/layered graphs.

Most underexploited point: labels and visual hierarchy may have higher product ROI than another node shader tweak. A beautiful graph needs landmarks.

### Perceptual Scheduling

Strongest opportunities:

- Visual mass conservation: density fades down as exact nodes and edges fade in.
- Motion-gated LOD swaps: perform changes during pan, zoom, selection ripple, or local shimmer.
- Semantic foveation: refine selected, hovered, searched, central, and high-importance regions first.
- Attention texture: make cursor/selection/search/viewport-center priority a GPU scheduling primitive.
- Edge flow first, exact fan-out near focus.

Most underexploited point: current LOD layers can still add visual energy
independently. The next quality step is to make all layers share one perceptual
brightness/detail budget.

## Micro-Project Portfolio

Each project below has a concrete outcome. It should stand alone, benchmark, and either ship or close.

### P0. Frame Pacing Profiler

Outcome: every benchmark frame reports CPU spans, GPU pass timings, pass counts, and WebGPU object churn.

Why first: we need a scoreboard before optimizing abstractions or pass shape.

Acceptance:

- Benchmark JSON includes CPU p50/p95/max for hover, simulation encode, sync encode, canvas encode, submit-adjacent spans.
- Counts per frame for render passes, compute passes, `createBindGroup`, `createBuffer`, `createTexture`, pipelines.
- Existing GPU timestamp data remains intact.

### P1. Production Combined Canvas Pass

Outcome: production rendering uses one canvas pass when detailed timing is off; split passes remain available for profiling.

Why: profiling structure should not impose production pass overhead.

Acceptance:

- Config or internal mode: `combined` vs `split-for-timing`.
- Benchmark at 100k/250k/500k with `msaa=1`.
- Keep if p95 frame time or CPU encode time improves materially; otherwise close with data.

### P2. Draw-Indirect Smoke Test

Outcome: WebGPU can draw from a GPU-written indirect args buffer without CPU readback.

Why: this de-risks GPU culling/compaction before we build the full system.

Acceptance:

- Either luma is patched or a raw render-pass escape hatch exists.
- A trivial point draw uses `[4, instanceCount, 0, 0]` from a storage/indirect buffer written by compute.
- No CPU readback sets instance count.

### P3. Exact Point Visible List

Outcome: exact point rendering draws compacted visible point IDs instead of launching all points.

Why: preserve visual truth while reducing work.

Acceptance:

- Strict exact mode with `pointMinPixelSize = 0` matches current output for visible points.
- Thresholded mode matches existing pragmatic thresholds.
- Panned/zoomed views show lower point vertex invocations and reduced GPU or CPU frame cost.
- Prefix-sum compaction preserves input order in strict exact mode.

### P4. Exact Edge Visible List

Outcome: offscreen links no longer pay full ribbon vertex cost.

Why: edges are likely the real scaling wall after points are optimized.

Acceptance:

- Conservative edge AABB classification supports straight and curved links.
- No visible curves disappear in pan/zoom tests.
- Additive-link atomic compaction may be used if order is visually irrelevant.
- Benchmark reports visible edge count and edge pass time.

### P5. Stable Bind Groups And Uniform Arena

Outcome: common point/line draw paths stop doing per-frame resource rebinding and many tiny uniform writes.

Why: this is low-level frame-pacing work that aligns with the product thesis.

Acceptance:

- After warmup, common point path performs zero `createBindGroup` calls per frame.
- Uniform write call count drops by at least 70% in render-only mode.
- CPU encode p95 is reported before/after.

### P6. Raw Point Fast Path Benchmark

Outcome: isolate luma overhead from shader/fill cost with a raw WebGPU point draw path using Kajillion's actual point buffers/shader semantics.

Why: raw WebGPU should be surgical, not ideological.

Acceptance:

- Table compares luma `Model` vs raw path for GPU point pass, CPU encode p95, bind-group churn, and visual parity.
- Raw code ships only if it wins enough to justify duplicate pipeline code.

### P7. Beauty Preset Pipeline

Outcome: a coherent dark/light visual preset that makes 50k/250k/1M screenshots look intentional.

Why: immediate product ROI using mostly existing controls.

Acceptance:

- Dark and light screenshots at overview and mid-zoom.
- Dense cores retain hue and structure.
- Sparse tendrils remain visible.
- Labels and highlights remain readable.

### P8. Stable Hierarchical Labels

Outcome: calm cluster/hub labels that do not pop during common pan/zoom.

Why: labels turn a beautiful graph into a navigable graph.

Acceptance:

- Overview labels name major regions.
- Label active ranges use hysteresis and fades.
- No visible label popping during slow zoom.
- Common demo sizes avoid label overlap.

### P9. Core/Aura Density Composite

Outcome: dense regions feel luminous without turning into white blobs.

Why: beauty and perceptual density both depend on controlled tone mapping.

Acceptance:

- Core and aura terms are separable/debuggable.
- High-density hubs retain hue.
- Smaller clusters remain visible near large clusters.
- Labels/focus rings are not swallowed by density.

### P10. Blue-Noise Hybrid Anchors

Outcome: the same anchor budget looks closer to exact because anchors preserve outliers, boundaries, minority colors, and hubs.

Why: if impostors are kept for far overview, anchor choice is the difference between convincing and fake.

Acceptance:

- Same `impostorAnchorsPerTile` beats current atomic/hash fill in A/B screenshots.
- Sparse tendrils survive LOD.
- Anchor set is stable at fixed camera.

### P11. Tile Moment Splat Upgrade

Outcome: dense tiles emit plausible anisotropic point texture from covariance instead of fog or regular blobs.

Why: uses data already available in the tile path.

Acceptance:

- At 500k/1M overview, dense regions read as rich point texture.
- No obvious tile boundaries during slow pan.
- Bounded cost remains tied to visible tiles and splat count.

### P12. Soft-Lane Edge Bundling Upgrade

Outcome: edge fields read as soft corridors while endpoint truth remains exact.

Why: edge beauty and edge legibility may beat raw edge count as a product differentiator.

Acceptance:

- Curved and straight links have compatible lane behavior or explicit opt-out.
- Compatibility gates prevent unrelated routes from merging.
- Hover/focus remains exact.

### P13. Cluster Terrain Layer

Outcome: dense communities read as shaped regions with interior texture, boundaries, landmarks, and outgoing lanes.

Why: this is the high-upside beauty/perception project after labels and tone mapping.

Acceptance:

- Cluster silhouettes survive overview LOD.
- Multicolor communities do not collapse into gray or white.
- Boundaries stay stable under pan/zoom.

### P14. Hive/Lane Overview Story

Outcome: an alternate overview mode for typed/layered/bipartite graphs that demonstrates Kajillion is not just a force-directed hairball renderer.

Why: high demo value and data honesty for graphs that are not best served by galaxy layout.

Acceptance:

- Axis/lane labels are stable.
- Hover, selection, and search still work.
- Transition back to force layout is visually coherent.

### P15. Visual Mass Conservation Crossfade

Outcome: exact nodes and edges can appear without a brightness jump.

Why: this directly targets pop-in and the flash reports. The user should feel
the scene sharpening, not changing.

Acceptance:

- Slow zoom/reveal shows no sudden point-count or brightness jump.
- Density/impostor contribution fades down as exact detail fades up.
- Stationary camera has no shimmer.
- Light mode does not create warm micro-flashes around dense clusters.

### P16. Motion-Gated LOD Scheduler

Outcome: LOD swaps happen during motion or attention shifts, not during still
inspection.

Why: perceptual scheduling is one of Kajillion's likely differentiators.

Acceptance:

- LOD changes can queue while still.
- Queued changes apply during pan, zoom, cursor motion, selection ripple, or local shimmer.
- Labels and exact detail settle after local stability.

### P17. Semantic Attention Texture

Outcome: a GPU-readable screen-space priority field guides refinement.

Why: foveation should be semantic for graphs: selected/search/high-centrality
regions matter more than peripheral density.

Acceptance:

- Cursor, selection, search result, viewport center, and graph importance can be visualized as a priority texture.
- Node and edge LOD can sample the field.
- Focus regions refine before background regions at fixed budget.

## Recommended Investment Order

### Batch 1: Measurement And Exact Plumbing

1. P0 Frame Pacing Profiler
2. P2 Draw-Indirect Smoke Test
3. P3 Exact Point Visible List
4. P4 Exact Edge Visible List

Reason: this validates the core claim that Kajillion can be faster without visual compromise.

### Batch 2: Low-Level Clean Path

1. P1 Production Combined Canvas Pass
2. P5 Stable Bind Groups And Uniform Arena
3. P6 Raw Point Fast Path Benchmark

Reason: this hardens the renderer into a low-jitter product path.

### Batch 3: Immediate Product Beauty

1. P7 Beauty Preset Pipeline
2. P8 Stable Hierarchical Labels
3. P9 Core/Aura Density Composite
4. P12 Soft-Lane Edge Bundling Upgrade

Reason: this produces visible wow and navigability.

### Batch 4: Perceptual Massive Detail

1. P15 Visual Mass Conservation Crossfade
2. P16 Motion-Gated LOD Scheduler
3. P10 Blue-Noise Hybrid Anchors
4. P11 Tile Moment Splat Upgrade
5. P17 Semantic Attention Texture
6. P13 Cluster Terrain Layer
7. P14 Hive/Lane Overview Story

Reason: this is where we make large graphs feel impossible without paying exact cost everywhere.

## Benchmark Policy

Every implementation project must report:

- Wall FPS p50/p95/max.
- GPU pass timings.
- CPU encode spans.
- Render/compute pass counts.
- Object churn.
- Visible node/edge counts when relevant.
- Screenshot or video comparison against exact baseline.

Standard runs:

- 50k, 100k, 250k, 500k, and eventually 1M.
- `data=cosmo`, fixed seed, fixed viewport, DPR 1 and target machine notes.
- Static settled render and motion pan/zoom stress.
- Exact baseline and candidate path.

## Near-Term Decision

Do not spend the next implementation cycle polishing screen-space binning. Keep it gated.

Start with P0 and P2. Without a profiler and a proven indirect draw path, GPU-driven exact culling is speculative. Once those are in, P3 and P4 become the first serious performance projects.

In parallel or immediately after, P7 and P8 are the fastest route to a better-looking product demo.
