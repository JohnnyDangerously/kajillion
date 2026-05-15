# 2026-05-14 - Research Track 3: Perceptual Multipliers

Goal: identify techniques where a bounded number of rendered primitives creates the perception of far more graph nodes without a visible LOD seam. Target workload is Kajillion's WebGPU graph renderer at 50k-1M nodes, especially dense overview zooms where individual identity is already below the perceptual threshold but color, density, silhouette, outliers, and interactive anchors still matter.

## Local Context

Kajillion already has the right first pieces:

- `renderLodMode` separates exact, phantom, impostor, and auto strategies; `impostorTileSize`, `impostorMicroSplats`, `impostorExactOverlay*`, and `impostorAnchorsPerTile` expose the current bounded-impostor controls. See [config.ts](/Users/john/repos/kajillion/src/config.ts:340).
- The exact point shader has stable hashed sampling plus size/opacity compensation keyed by `instanceIdx`, with nested sampling behavior as zoom changes. See [draw-points.wgsl](/Users/john/repos/kajillion/src/modules/Points/draw-points.wgsl:192).
- The tile impostor path aggregates points into screen-space tiles, resolves count/color/centroid/variance/covariance, and draws at most `tileCount * microSplats` quads. See [Points/index.ts](/Users/john/repos/kajillion/src/modules/Points/index.ts:2013) and [draw-tile-impostors.wgsl](/Users/john/repos/kajillion/src/modules/Points/draw-tile-impostors.wgsl:52).
- The hybrid anchor path keeps real nodes in sparse tiles and a bounded sample in dense tiles. See [fill-hybrid-anchors.compute.wgsl.ts](/Users/john/repos/kajillion/src/modules/Points/fill-hybrid-anchors.compute.wgsl.ts:59) and [Points/index.ts](/Users/john/repos/kajillion/src/modules/Points/index.ts:2145).

The current implementation is already a "perceptual multiplier": it can replace hundreds of exact point sprites in a dense screen tile with one or a few stable micro-splats plus selected real anchors. The research question is how to make that illusion more convincing and less detectable in motion.

## Findings

### 1. Screen-space aggregation is the right base representation for overview zooms

Datashader's core model is to rasterize/aggregate arbitrary-size datasets into fixed-size regular grids and shade those grids as images; only the aggregation stage touches the full dataset, while later stages are fixed by output resolution. Datashader documents this as preserving distribution for very large data and avoiding subsampling artifacts at display scale: <https://datashader.org/getting_started/Introduction.html> and <https://datashader.org/getting_started/Pipeline.html>.

Deck.gl's aggregation docs make the same performance argument from a browser GPU point of view: GPU aggregation has setup cost, but for large datasets the marginal cost of more points is small; their examples show GPU aggregation becoming much faster by 100k-1M items. Source: <https://deck.gl/docs/api-reference/aggregation-layers/overview>.

Implication for Kajillion:

- Keep tile/density impostors screen-space for the far view. A graph overview is not a geometry-inspection task; it is a density, color, and silhouette task.
- Use the exact point path only where it buys identity: sparse tiles, hover neighborhoods, focus/highlight sets, labels, and zoom ranges where a point is more than roughly 1-2 pixels.
- Treat the impostor tile buffer as a small G-buffer: count, weighted color, centroid, covariance, outlier flags, and maybe dominant cluster/color classes.

### 2. Splatting gives the perceptual language for "many points from one representative"

QSplat rendered huge scanned models using a multiresolution hierarchy, bounding spheres, point splats, view-frustum/backface culling, LOD selection, and progressive refinement while maintaining an interactive frame rate. Source: <https://graphics.stanford.edu/papers/qsplat/>.

Surface Splatting generalizes points into screen-space filtered kernels, using EWA-style filtering to avoid aliasing from irregular point samples. It is a surface-rendering paper, not a graph paper, but the lesson transfers: if the representative is a filtered footprint with the right variance and color, the viewer reads it as many sub-pixel samples instead of one fake dot. Source: <https://www.cs.umd.edu/~zwicker/publications/SurfaceSplatting-SIG01.pdf>.

Point-Based Impostors and Multi-Layered Impostors add two useful constraints: bounded complexity and controlled error. Wimmer/Wonka/Sillion describe replacing complex models with point-like impostors while controlling sample density for all views from a view cell; Decoret et al. describe layered impostors that bound de-occlusion error and exploit temporal coherence. Sources: <https://www.cg.tuwien.ac.at/research/publications/2001/Wimmer-2001-Poi/> and <https://graphics.cs.yale.edu/publications/multi-layered-impostors-accelerated-rendering>.

Implication for Kajillion:

- Current tile impostors already store centroid, variance, and covariance. Use those moments more aggressively: render anisotropic Gaussian/ellipse splats instead of round dots when a tile has a clear local direction.
- A tile should not always emit `N` equal micro-splats. It should emit a small constellation whose positions approximate the tile's first two moments and whose alpha follows a tone-mapped count curve.
- The impostor should be explicitly "bounded complexity": target `visibleTiles * 1-4` splats plus `visibleTiles * anchorsPerTile` exact anchors, not a percentage of total nodes.

### 3. Blue-noise sampling is better than hash-random for visible representatives

Kajillion's current `hash01(instanceIdx)` sampling is stable, cheap, and nested, which is good. But it is still white-ish in screen space. Scatterplot sampling research found that random sampling is good for region density, while blue-noise sampling is strong for outliers and overall shape preservation. Source: <https://arxiv.org/abs/2007.14666>.

Graph-specific blue-noise sampling work frames sampling as choosing vertices that maximize distance on the graph/vertex domain and suppress low-frequency sampling error. This is relevant because Kajillion nodes are not just points in 2D; neighborhoods, communities, and graph-distance structure matter. Source: <https://scholars.uky.edu/es/publications/blue-noise-sampling-on-graphs>.

Implication for Kajillion:

- Replace pure index hashing for exact anchors with tile-local reservoir candidates scored by screen-space separation, color/cluster diversity, and optionally graph degree. This preserves silhouettes and rare colors better than "first N atomic winners."
- Keep sampling stable by storing or deterministically recomputing anchor slots from `(tileId, pointId, zoomBand)`, not frame number.
- Consider a cheap two-pass anchor fill: first accept sparse/outlier/color-diverse points, then fill remaining slots with stable blue-noise-like candidates.

### 4. Temporal stability is a first-class feature, not polish

NVIDIA's spatiotemporal blue-noise work is directly applicable. Their key finding is that independent blue-noise masks per frame create temporally white noise; spatiotemporal masks keep spatial blue-noise properties while improving temporal distribution and stability under temporal filtering. Source: <https://research.nvidia.com/publication/2021-12_scalar-spatiotemporal-blue-noise-masks>.

Stochastic LOD/dithered LOD transitions are a mature way to avoid popping: randomly assign pixels or samples to adjacent LODs during the transition, creating a cross-dissolve instead of a discrete switch. Source: <https://developer.nvidia.com/blog/implementing-stochastic-lod-with-microsoft-dxr/>.

Implication for Kajillion:

- Do not reshuffle impostor micro-splats every frame. Use stable seeds in graph/tile space. Camera motion may change tile membership, but tile-internal micro positions should be deterministic.
- Crossfade exact and impostor contributions by zoom band and tile density. Avoid an abrupt `exact -> impostor` mode flip.
- If temporal accumulation is introduced later, use a tiny history buffer only for the density/impostor layer, not for interactive highlights. The history must reset or clamp on camera jumps and graph-layout motion.

### 5. Point-cloud LOD gives a useful hierarchy model, but Kajillion should stay screen-driven first

Potree's thesis describes a hierarchy of subsamples at different resolutions, with low-resolution data in the root and increasing density at deeper levels. It culls outside the view frustum and renders distant areas at lower detail, enabling browser-scale rendering of very large point clouds. Source: <https://repositum.tuwien.at/handle/20.500.12708/1624>.

Recent point-cloud work also shows two adjacent paths:

- Compute-shader point rendering can outperform the fixed hardware point pipeline and reduce aliasing; one paper reports very high throughput on desktop GPUs, but this is still exact or near-exact point rendering, not a perceptual multiplier. Source: <https://arxiv.org/abs/2104.07526>.
- GPU-generated LOD structures can produce layered point cloud variants with color filtering at very high construction rates. Source: <https://arxiv.org/abs/2302.14801>.

Implication for Kajillion:

- A persistent world-space hierarchy is useful for static baked 1M demos and large settled graphs, but live force simulation makes full hierarchical maintenance expensive.
- For the active simulation view, screen-space tile bins are the cheaper hierarchy. They rebuild every frame from current positions, exactly where the user is looking.
- For baked/static mode, a world-space cluster hierarchy could preserve color, degree, and silhouette summaries and feed the same impostor shaders without rebinning every point every frame.

## Technique Assessment

| Technique | Why it matters | Fit for Kajillion | Risk |
|---|---|---|---|
| Stable hashed sampling | Cheap draw reduction, already present | Keep as baseline and fallback | White-noise gaps and weak outlier/color preservation |
| Screen-space density tiles | Fixed visual cost by framebuffer size | Already implemented; highest leverage | Tile grid artifacts, shimmer during pan/zoom |
| Moment-based micro-constellations | One tile emits believable local point texture | Add anisotropic placement from existing variance/covariance | Can look fake if too regular or too bright |
| Hybrid exact anchors | Preserves real identity where viewer can notice | Already implemented; improve selection quality | Atomic fill order can bias anchors |
| Blue-noise anchor selection | Better shape/outlier preservation for small samples | Good micro-project; compute-friendly with tile-local scoring | More GPU passes and buffer pressure |
| Cluster/color representatives | Preserves community color and silhouette | Good for graph data with clusters/colors | Requires additional per-tile histograms or summaries |
| Dithered LOD crossfade | Hides exact/impostor transitions | Strong fit; can use stable tile/noise masks | Dither noise if not temporally stable |
| Precomputed impostor atlases | Rich texture from one quad | Useful for static/baked clusters; less for live sim | Atlas memory, stale under simulation |
| World-space LOD hierarchy | Useful for static 1M+ and baked demos | Later project, not first live-sim fix | Hard to maintain during force layout |
| Temporal accumulation | Can make stochastic density look smoother | Later, only for non-interactive density layer | Ghosting during graph motion/camera jumps |

## Recommended Micro-Projects

### A. Tile Moment Splat Upgrade

Outcome: each dense tile draws 1-4 anisotropic Gaussian-like micro-splats whose footprint follows tile covariance, replacing or augmenting current round dots.

Implementation sketch:

- Reuse `resolvedTiles` count/color/centroid/variance/covariance.
- In `draw-tile-impostors.wgsl`, derive ellipse axes from variance and covariance.
- Emit `microSplats` positions from a deterministic low-discrepancy/blue-noise table in ellipse space.
- Keep sparse tiles exact-only, as today.

Success criteria:

- At 500k and 1M overview, dense regions read as rich point texture rather than fog or grid cells.
- `impostor.tiles.* + drawImpostorComposite` remains bounded by visible tile count and improves `render.canvas` when compared with exact point rendering.
- No obvious tile boundaries during slow pan.

### B. Blue-Noise Hybrid Anchors

Outcome: exact overlay anchors preserve outliers, silhouettes, and minority colors better than hash/random slots at the same anchor budget.

Implementation sketch:

- Add a tile-local candidate score in `fill-hybrid-anchors.compute.wgsl.ts`.
- Score high for sparse tiles, rare colors/cluster ids if available, high degree if available, and distance from existing accepted anchors.
- If full blue-noise selection is too expensive, approximate with multiple deterministic candidate buckets per tile: center, extremal x/y, rare color, and hash sample.

Success criteria:

- Same `impostorAnchorsPerTile` looks more like exact rendering in screenshot A/B tests.
- Sparse tendrils and low-density boundary points survive LOD.
- Anchor set is stable across frames at fixed camera.

### C. Exact/Impostor Crossfade Band

Outcome: `renderLodMode: auto` moves between exact/phantom/impostor without a visible snap.

Implementation sketch:

- Define a zoom/density transition weight per tile.
- In dense tiles, fade exact anchors down as tile splats fade up; in sparse tiles keep exact fully visible.
- Use a stable blue-noise or Bayer/STBN mask to dither the transition per tile or per micro-splat, not per frame.

Success criteria:

- Slow zoom through the transition band shows no sudden point-count or brightness jump.
- Highlights/hover/outlined points remain exact and unaffected.
- No flickering when camera is stationary.

### D. Color/Silhouette Representatives

Outcome: dense tiles and cluster cells preserve the perceived color mix and outline of communities, not just average density.

Implementation sketch:

- Extend tile resolve to store either two dominant colors/classes or simple color variance.
- Draw two lower-alpha micro-splat populations if a tile is color-mixed instead of one averaged color.
- Bias exact anchors toward tile boundary and rare-color samples.

Success criteria:

- Multicolor communities do not collapse into gray/muddy averages.
- Cluster edges preserve shape at overview zoom.
- Low-frequency color field remains stable under pan.

### E. Static Baked Cluster Atlas

Outcome: for baked 1M static demos, large settled communities can render as atlas impostors plus exact anchors, reducing per-frame binning and exact draw pressure.

Implementation sketch:

- During bake, compute community/world-space cluster summaries: bounding box, count, color histogram, covariance, boundary sample points, and a small generated microtexture seed.
- At runtime, draw cluster impostor quads/ellipses until zoom crosses a screen-size threshold, then crossfade to tile/exact rendering.
- Keep hover/picking on exact points via existing buffers; atlas is purely visual.

Success criteria:

- Faster first-frame and overview rendering in baked 1M mode.
- No obvious atlas-card edges; transition to exact/tile render is dithered.
- The atlas never replaces interaction truth.

## Practical Guidance

1. Tune perception by tile density, not total node count. A 1M graph can have sparse visible regions that should stay exact, and a 100k graph can have a dense core that benefits from impostors.
2. Keep "identity truth" separate from "density truth." Interaction, labels, hover, and highlight need exact nodes. The background field only needs to preserve density, color, shape, and motion stability.
3. Use bounded draw cost as the north star. The point of this track is not merely fewer exact nodes; it is making render cost scale with visible tiles and selected anchors.
4. Prefer deterministic noise over time-varying noise until there is a temporal reconstruction pass. Static noise is less offensive than shimmer in a graph UI.
5. Do not chase full point-cloud hierarchy first for live simulation. Screen-space aggregation matches the moving-data problem better.

## Source List

- QSplat: A Multiresolution Point Rendering System for Large Meshes - <https://graphics.stanford.edu/papers/qsplat/>
- Surface Splatting - <https://www.cs.umd.edu/~zwicker/publications/SurfaceSplatting-SIG01.pdf>
- Point-Based Impostors for Real-Time Visualization - <https://www.cg.tuwien.ac.at/research/publications/2001/Wimmer-2001-Poi/>
- Multi-Layered Impostors for Accelerated Rendering - <https://graphics.cs.yale.edu/publications/multi-layered-impostors-accelerated-rendering>
- Scalar Spatiotemporal Blue Noise Masks - <https://research.nvidia.com/publication/2021-12_scalar-spatiotemporal-blue-noise-masks>
- Implementing Stochastic Levels of Detail with DXR - <https://developer.nvidia.com/blog/implementing-stochastic-lod-with-microsoft-dxr/>
- Evaluation of Sampling Methods for Scatterplots - <https://arxiv.org/abs/2007.14666>
- Blue-Noise Sampling on Graphs - <https://scholars.uky.edu/es/publications/blue-noise-sampling-on-graphs>
- Potree: Rendering Large Point Clouds in Web Browsers - <https://repositum.tuwien.at/handle/20.500.12708/1624>
- Rendering Point Clouds with Compute Shaders and Vertex Order Optimization - <https://arxiv.org/abs/2104.07526>
- GPU-Accelerated LOD Generation for Point Clouds - <https://arxiv.org/abs/2302.14801>
- Datashader introduction and pipeline - <https://datashader.org/getting_started/Introduction.html>, <https://datashader.org/getting_started/Pipeline.html>
- Deck.gl aggregation layers and performance notes - <https://deck.gl/docs/api-reference/aggregation-layers/overview>, <https://deck.gl/docs/developer-guide/performance>
