# 2026-05-14 - Research Track 4: Beauty-First Graph Rendering

Goal: identify visual techniques that make Kajillion's 50k-1M node graphs look beautiful, legible, and deliberate rather than merely dense. The emphasis is on edge bundling and soft lanes, graph aesthetics, stable labels, color blending and tone mapping, bloom-like density cores, cluster visual design, alternate overview views, and zoom-aware visual hierarchy.

## Local Context

Kajillion already has several beauty-first primitives in place:

- Link rendering supports premultiplied alpha and an additive `linkBlendMode` for density-field-like edge accumulation. See [config.ts](/Users/john/repos/kajillion/src/config.ts:283) and [Lines/index.ts](/Users/john/repos/kajillion/src/modules/Lines/index.ts:287).
- Straight links already have `linkBundlingStrength` and `linkBundlingCellSize`, implemented as a lightweight screen/world-space soft-lane nudge with exact endpoints. See [draw-straight-line.wgsl](/Users/john/repos/kajillion/src/modules/Lines/draw-straight-line.wgsl:120).
- Curved links use rational quadratic Bezier ribbons, but the current soft-lane function is only in the straight-link WGSL path. See [draw-curve-line.wgsl](/Users/john/repos/kajillion/src/modules/Lines/draw-curve-line.wgsl:1).
- Point overviews already have tile impostors, hybrid exact anchors, stable sampling, and an exponential tone-mapped density composite. See [draw-tile-impostors.wgsl](/Users/john/repos/kajillion/src/modules/Points/draw-tile-impostors.wgsl:1), [fill-hybrid-anchors.compute.wgsl.ts](/Users/john/repos/kajillion/src/modules/Points/fill-hybrid-anchors.compute.wgsl.ts:1), and [composite-density-impostors.wgsl](/Users/john/repos/kajillion/src/modules/Points/composite-density-impostors.wgsl:1).
- Labels exist as a DOM story helper anchored to cluster centroids, but there is no general label engine, collision model, zoom hierarchy, or stability policy. See [create-cluster-labels.ts](/Users/john/repos/kajillion/src/stories/create-cluster-labels.ts:1).

The main opportunity is to turn these isolated pieces into a visual system: exact interaction truth, soft density/cluster support, stable labels, and scale-specific hierarchy.

## Findings

### 1. Edge bundling should be "soft lane rendering", not full route rewriting

Holten and van Wijk's force-directed edge bundling treats edges as flexible springs that attract compatible edges, reducing clutter and exposing high-level edge patterns without requiring a hierarchy or control mesh. Source: <https://research.tue.nl/nl/publications/force-directed-edge-bundling-for-graph-visualization/>.

The downside is faithfulness. Wu et al. argue that bundled visualizations can lose information and create inter-bundle ambiguity as more edges merge. Source: <https://www.mdpi.com/1099-4300/20/9/625>. Newer approaches such as Edge-Path Bundling explicitly target ambiguity reduction by keeping route information more separable. Source: <https://arxiv.org/abs/2108.05467>.

Implication for Kajillion:

- Keep endpoints exact and keep the bundling effect visually reversible. The existing sine-envelope lane nudge is directionally right because it reads as a corridor, not as a new topology.
- Add compatibility gates before increasing strength: similar direction, similar length scale, nearby midpoint, and possibly same cluster/community. Avoid bundling crossing communities just because their midpoints share a cell.
- Port soft lanes to curved links or make curved links opt out of bundling explicitly. A beauty preset should not silently lose lane behavior when `curvedLinks: true`.
- Prefer "ordered lanes" or small strand offsets inside a bundle over a single merged tube. It preserves the sense of many relations and lowers ambiguity.

### 2. Classic graph aesthetics still matter, but dense graphs need aggregate versions

Graph drawing aesthetics research repeatedly highlights crossings, crossing angles, bends, symmetry, angular resolution, and vertex distribution as factors in readability. Purchase et al. empirically tested symmetry, minimized crossings, and minimized bends as graph drawing aesthetics. Source: <https://research.monash.edu/en/publications/an-experimental-study-of-the-basis-for-graph-drawing-algorithms/>. Later work found larger crossing angles improve graph comprehension. Source: <https://www.sciencedirect.com/science/article/pii/S1045926X14000317>.

For Kajillion-scale graphs, exact crossing minimization is unrealistic per frame, but the aggregate principle remains useful:

- At overview zoom, optimize perceived lane separation and crossing angle between major edge corridors, not every individual edge.
- Preserve angular separation around hubs with halo/focus rendering, tapered edges, and local decluttering instead of trying to show all incident links equally.
- Use cluster layout forces and color fields to create symmetry and silhouette. The viewer reads a beautiful large graph through coherent community shapes first.

### 3. Labels need stability rules before placement cleverness

Dynamic map labeling literature is directly applicable because graph labels move under pan, zoom, and simulation. Been, Daiches, and Yap frame dynamic labeling around avoiding popping while remaining interactive. Source: <https://doi.org/10.1109/TVCG.2006.136>. A later unified model names three practical desiderata: monotonicity, invariant point placement, and history independence. Source: <https://link.springer.com/article/10.1007/s00453-020-00694-7>. Fast dynamic point-label placement work emphasizes real-time de-confliction when preprocessing is not available. Source: <https://arxiv.org/abs/1209.5765>.

Implication for Kajillion:

- Labels should be sparse and hierarchical: global cluster names at far zoom, selected hubs and search/focus results at mid zoom, point labels only at near zoom.
- Avoid popping by using zoom bands with hysteresis and opacity fades. A label should not blink during slow wheel zoom or small pan.
- Use persistent label slots anchored to real graph structure: cluster centroid, highest-degree landmark in a cluster, focused node, or selected search result.
- Keep label placement outside the hot GPU path initially. A worker/DOM or Canvas2D overlay can consume sampled positions and cluster centroids while the renderer keeps 60 fps.

### 4. Color and blending should be linear-light and perceptual, not incidental RGBA

ColorBrewer's practical distinction among sequential, diverging, and qualitative palettes remains a good product-level constraint for graph themes. Source: <https://colorbrewer2.org/>. Perceptual colormap research warns that bad color maps can hide features through nonuniform lightness. Source: <https://arxiv.org/abs/1509.03700>. Oklab/OKLCH gives a modern, implementation-friendly perceptual space for palette generation and interpolation. Source: <https://bottosson.github.io/posts/oklab/>.

Implication for Kajillion:

- Generate qualitative cluster palettes in OKLCH with controlled lightness/chroma, then convert to linear RGB for shader blending.
- Keep additive density accumulation in a float target where possible, then tone map. Additive directly into `bgra8unorm` risks white washout and hue loss.
- For mixed-color density tiles, average in a perceptual or linear-light representation and keep a variance/dominant-color signal. Naive RGB averages make multicolor communities muddy.
- Provide dark and light theme presets as whole systems: background, point lightness, edge opacity, density tone curve, label halo, and highlight colors.

### 5. Bloom-like cores should be bounded tone mapping, not screen-wide glow

Bloom is powerful because HDR bright regions are blurred and composited before tone mapping; done subtly it conveys intensity without losing detail. Source: <https://learnopengl.com/Advanced-Lighting/Bloom>. HDR tone mapping maps high dynamic range values back into display range without simply clipping highlights; Reinhard-style `x / (x + 1)` and exponential forms are cheap and predictable. Source: <https://learnopengl.com/Advanced-Lighting/HDR>. WebGPU is also gaining explicit HDR canvas tone-mapping support in Chrome, but support is platform/browser dependent. Source: <https://developer.chrome.com/blog/new-in-webgpu-129>.

Kajillion's `composite-density-impostors.wgsl` already uses `1 - exp(-density * strength)` and clamps alpha. That is the right shape for a density glow.

Implication for Kajillion:

- Keep bloom local to graph density layers. Do not add a global blur pass until the density composite has per-layer tone controls.
- Split "core" and "aura": the core carries exact or near-exact color and high alpha; the aura is low-alpha, radius-limited, and tone-mapped.
- Use cluster-aware exposure so one huge component does not force every smaller component into invisibility.
- Add debug views for raw density, tone-mapped density, and final composite. Beauty tuning without visibility into saturation is guesswork.

### 6. Dense cluster design should read like terrain, not fog

At a distance, users perceive large graphs as regions, borders, landmarks, and flows. This aligns with graph mapping systems that build multi-scale community visualizations for massive graph data; their labels can come from high-degree child landmarks that remain stable across levels. Source: <https://journals.sagepub.com/doi/10.1177/1473871616661195>. Topological fisheye work similarly argues that large graphs need a hierarchy of coarsened representations rendered at different levels of detail. Source: <https://www.graphviz.org/documentation/GKN04a.pdf>.

Implication for Kajillion:

- Treat a cluster as a visual object: silhouette, center, border, interior texture, top hubs, and outbound lanes.
- Use density impostors for soft interiors, exact anchors for texture, labels for landmarks, and edge lanes for flows between regions.
- Preserve boundaries by biasing anchors toward cluster hull/boundary samples and by reducing aura opacity at borders.
- Introduce a "cluster field" layer before a general post-bloom layer. It can be built from existing cluster centroids, tile moments, and color summaries.

### 7. Alternate views are legitimate overview modes, not replacements for node-link interaction

Hive plots place nodes on radial axes using structural properties, creating quantitative, comparable network layouts instead of force-directed hairballs. Source: <https://academic.oup.com/bib/article/13/5/627/412507> and <https://hiveplot.com/>. BioFabric draws nodes as horizontal lines arranged in rows and edges as vertical links, explicitly "combing" large network hairballs. Source: <https://pubmed.ncbi.nlm.nih.gov/23102059/>. Matrix views can outperform node-link diagrams for dense or larger graphs on many tasks. Source: <https://courses.ischool.berkeley.edu/i247/f05/readings/Ghoniem-GraphReadability_InfoVis04.pdf>.

Implication for Kajillion:

- Do not force every dataset into a galaxy view. Add alternate overview stories for typed, layered, temporal, or bipartite graphs.
- A hive/lane mode is a natural fit for Kajillion's GPU line renderer: positions become deterministic axes, and edge bundling becomes lane styling.
- Keep alternate views linked to the same interaction model: hover, selection, search, highlighted nodes/links, and animated transitions back to spatial graph mode.
- Use these views as beauty demos and data honesty tools. They make structure inspectable when the force-directed view is attractive but ambiguous.

### 8. Visual hierarchy under zoom should be semantic, not only geometric

Semantic zooming replaces representations as the user changes scale: density field, clusters, labels, exact points, individual links, and node labels appear at different levels. Recent semantic zoom + edge bundling work in supply-chain flow visualization combines bundled flows, density aggregation, and hierarchical views. Source: <https://arxiv.org/abs/2604.08823>. Multi-level tree graph visualization lists useful guarantees: persistent nodes across deeper levels, overlap-free labels, real vertices/paths, and no crossings at each level. Source: <https://arxiv.org/abs/1906.05996>.

Implication for Kajillion:

- Define zoom bands around perceptual tasks: overview, region, neighborhood, inspection, and focus.
- Each band should have a dominant visual truth: density/cluster field, major lanes, hub labels, exact points, exact links, then point labels.
- Use hysteresis and crossfades so moving between bands feels continuous.
- Make focus/search/highlight exempt from LOD. User intent should cut through the hierarchy.

## Recommended Micro-Projects

### A. Beauty Preset Pipeline

Outcome: a coherent visual preset for dark and light backgrounds that tunes point opacity, link opacity, additive mode, density tone mapping, labels, hover/focus rings, and MSAA together.

Implementation sketch:

- Add a story/demo preset rather than new public API first.
- Use OKLCH-generated cluster colors with controlled lightness and chroma.
- Tune `linkBlendMode: 'add'`, low link alpha, `impostorCompositeStrength`, tile opacity, and label halo color as one scene.
- Add screenshots at 50k, 250k, and 1M overview plus mid-zoom.

Success criteria:

- Dense cores have visible color and structure, not white blobs.
- Sparse tendrils and small clusters remain visible.
- Light and dark themes both pass basic label/readability checks.

### B. Soft-Lane Edge Bundling Upgrade

Outcome: edge fields read as soft corridors while preserving endpoint truth and avoiding misleading merged routes.

Implementation sketch:

- Port the straight-link `softLaneOffset` to the curved WGSL path or make a unified lane helper.
- Add compatibility gates based on midpoint cell, direction cosine, length ratio, and optional cluster pair.
- Add subtle ordered strand offsets inside lanes.
- Add a debug story with slider controls for strength, cell size, and compatibility thresholds.

Success criteria:

- Major inter-cluster flows become legible at overview zoom.
- Hover/focus still lands on exact link IDs.
- Bundling does not create visually plausible routes between unrelated clusters.

### C. Stable Hierarchical Labels

Outcome: cluster and hub labels that feel calm during pan/zoom and simulation.

Implementation sketch:

- Start as overlay infrastructure, not GPU text.
- Rank candidates by cluster size, degree, search/focus state, and screen-space separation.
- Use label active ranges with hysteresis, monotonic zoom behavior, and fade-in/out.
- Cache chosen label anchors per zoom band to avoid re-solving every frame.

Success criteria:

- No visible label popping during slow zoom.
- Labels do not overlap in common demo sizes.
- At overview zoom the user can name major regions without inspecting individual nodes.

### D. Core/Aura Density Composite

Outcome: bloom-like graph density that feels luminous without washing out color or labels.

Implementation sketch:

- Split density rendering into core and aura terms inside the existing tile/density composite.
- Use a float density target and tone-map per layer before compositing to `bgra8unorm`.
- Add exposure/strength controls and debug views for raw density, core, aura, and final.
- Clamp aura contribution under labels and focus rings.

Success criteria:

- High-density hubs feel bright but retain hue.
- Neighboring clusters remain separable.
- Labels and selected nodes stay readable over dense cores.

### E. Cluster Terrain Layer

Outcome: dense communities read as shaped regions with boundaries and landmarks.

Implementation sketch:

- Reuse tile moments and cluster data to produce per-cluster density summaries.
- Bias exact anchors toward boundaries, high-degree landmarks, and minority colors.
- Draw low-alpha interior texture plus slightly sharper boundary support.
- Name clusters from caller-provided labels first, then degree landmarks as fallback.

Success criteria:

- Cluster silhouettes survive overview LOD.
- Multicolor communities do not collapse into gray.
- Boundaries stay stable during pan/zoom.

### F. Hive/Lane Overview Story

Outcome: an alternate beauty-first view for typed, layered, or bipartite graphs that demonstrates Kajillion is more than a force-directed hairball renderer.

Implementation sketch:

- Build a story that maps node type/community/degree to radial axes or parallel lanes.
- Use existing point and line buffers with deterministic positions.
- Render bundled or softly curved inter-axis links with low alpha and additive density.
- Keep hover, focus, and selection behavior identical to the normal graph story.

Success criteria:

- The same graph has a materially clearer overview for typed/layered data.
- Axis/lane labels stay stable.
- Transitioning between force and hive/lane positions is visually coherent.

## Project Ranking

| Rank | Project | Visual ROI | Implementation Risk | Why |
|---|---|---:|---:|---|
| 1 | Beauty preset pipeline | Very high | Low | Uses existing features and creates immediate demo quality. |
| 2 | Stable hierarchical labels | Very high | Medium | Labels turn beauty into navigability; current label story is minimal. |
| 3 | Core/aura density composite | High | Medium | Builds directly on existing tone-mapped density path. |
| 4 | Soft-lane bundling upgrade | High | Medium | Existing straight-link lane code proves feasibility; ambiguity controls matter. |
| 5 | Cluster terrain layer | High | Medium-high | Strong visual payoff, but needs cluster summaries and careful blending. |
| 6 | Hive/lane overview story | Medium-high | Medium | Valuable alternate mode, especially for demos, but not core renderer first. |

## Practical Guidance

1. Beauty must remain honest. When the renderer abstracts, it should preserve density, color, endpoints, cluster membership, and selected identity.
2. Avoid global effects first. Local tone curves, density cores, and cluster halos are safer than a full-screen bloom blur.
3. Labels are part of rendering quality, not UI garnish. A graph without stable landmarks looks like a screensaver at 1M nodes.
4. Make zoom bands explicit. Do not let independent shader constants accidentally define the visual hierarchy.
5. Keep exact interaction truth separate from aesthetic support layers. Hover, focus, search, and selection should always cut through impostors and density fields.

## Source List

- Force-Directed Edge Bundling for Graph Visualization - <https://research.tue.nl/nl/publications/force-directed-edge-bundling-for-graph-visualization/>
- Information-Theoretic Framework for Evaluating Edge Bundling Visualization - <https://www.mdpi.com/1099-4300/20/9/625>
- Edge-Path Bundling: A Less Ambiguous Edge Bundling Approach - <https://arxiv.org/abs/2108.05467>
- An Experimental Study of the Basis for Graph Drawing Algorithms - <https://research.monash.edu/en/publications/an-experimental-study-of-the-basis-for-graph-drawing-algorithms/>
- Larger Crossing Angles Make Graphs Easier to Read - <https://www.sciencedirect.com/science/article/pii/S1045926X14000317>
- Dynamic Map Labeling - <https://doi.org/10.1109/TVCG.2006.136>
- A Unified Model and Algorithms for Temporal Map Labeling - <https://link.springer.com/article/10.1007/s00453-020-00694-7>
- Fast Point-Feature Label Placement for Dynamic Visualizations - <https://arxiv.org/abs/1209.5765>
- ColorBrewer - <https://colorbrewer2.org/>
- Good Colour Maps: How to Design Them - <https://arxiv.org/abs/1509.03700>
- Oklab: A Perceptual Color Space for Image Processing - <https://bottosson.github.io/posts/oklab/>
- Bloom - <https://learnopengl.com/Advanced-Lighting/Bloom>
- HDR and Tone Mapping - <https://learnopengl.com/Advanced-Lighting/HDR>
- Chrome WebGPU HDR Canvas Tone Mapping - <https://developer.chrome.com/blog/new-in-webgpu-129>
- Graph Mapping: Multi-Scale Community Visualization of Massive Graph Data - <https://journals.sagepub.com/doi/10.1177/1473871616661195>
- Topological Fisheye Views for Visualizing Large Graphs - <https://www.graphviz.org/documentation/GKN04a.pdf>
- Hive Plots: Rational Approach to Visualizing Networks - <https://academic.oup.com/bib/article/13/5/627/412507>, <https://hiveplot.com/>
- BioFabric: Combing the Hairball - <https://pubmed.ncbi.nlm.nih.gov/23102059/>
- A Comparison of the Readability of Graphs Using Node-Link and Matrix-Based Representations - <https://courses.ischool.berkeley.edu/i247/f05/readings/Ghoniem-GraphReadability_InfoVis04.pdf>
- Semantic Zooming and Edge Bundling for Multi-Scale Supply Chain Flow Visualization - <https://arxiv.org/abs/2604.08823>
- Multi-Level Tree Based Approach for Interactive Graph Visualization with Semantic Zoom - <https://arxiv.org/abs/1906.05996>
