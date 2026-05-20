# Perceptual Galaxy Quality Spec

## Mission

Kajillion's overview renderer should create maximum perceived information
density while preserving enough local structure that the eye believes the detail
is real. The target visual regime is dense-structured: premium, cosmic,
information-rich, readable. Avoid sparse/unimpressive views and avoid
dense-saturated mud.

The renderer should optimize believable structure per pixel, not raw primitive
count.

## Visual Formula

Perceived quality is driven by:

```
Density
* Local Separation
* Hierarchy
* Coherence
* Depth
* Anti-aliasing / softness
- Mud
- Seams
- Random feature noise
```

Every screen tile should be treated as a perceptual budget. The engine should
ask whether a tile has enough dark space, local maxima, luminance hierarchy,
coherent color, stable motion, and separable structure.

## Failure / Success Pairs

### 1. Density

Failure: brute-force equal nodes become a white or gray mass. More nodes do not
automatically mean more quality.

Success: density field carries mass, micro-nodes add texture, anchors have
priority, and structure remains readable.

### 2. Separation

Failure: clustered dots merge into blurry blobs, destroying local detail.

Success: top nodes stay discrete, subtle dark gaps remain visible, and anchors
can use moats/rims sparingly.

### 3. Color

Failure: random per-node rainbow color creates feature congestion and visual
chaos.

Success: clusters have coherent local palettes. Bridges use restrained neutral
tones. Accent color is rare and meaningful.

### 4. Brightness

Failure: everything glows, no focal points exist, and the image becomes cheap
overexposure.

Success: glow is budgeted. Only important regions or hero nodes reach high
luminance.

### 5. Edges

Failure: every edge is an equal literal line, producing hairballs.

Success: far edges become relationship atmosphere, mid edges become major lanes,
and near/focused edges become exact lines.

### 6. Motion

Failure: random jitter, twinkle, boiling physics, or camera-independent noise
make the graph feel unstable.

Success: cluster-level motion, slow parallax, selected-path motion, and
low-frequency breathing make the scene feel alive without shaking.

### 7. LOD Transitions

Failure: abrupt popping reveals implementation boundaries.

Success: gradual reveal, crossfades, blue-noise ordering, and visual mass
conservation make detail feel like it crystallizes.

### 8. Shapes

Failure: all circles at all distances waste fill rate and flatten hierarchy.

Success: shape ladder by scale:

- Far: pixels or tiny squares.
- Mid: small discs.
- Near: SDF discs.
- Important: rim, core, halo, or glyph.

### 9. Borders

Failure: bright-on-bright nodes lose figure-ground separation.

Success: adaptive dark moats protect important nodes only where needed.

### 10. Saturation

Failure: additive rendering clips to white, losing detail and depth.

Success: log/filmic tone mapping keeps dense cores bright while preserving
color and internal structure.

### 11. Seams

Failure: tile boundaries, bins, or impostor patches become visible.

Success: padded tiles, overlapping kernels, blur/noise blending, and
stochastic reveals create a continuous field.

### 12. Hierarchy

Failure: every channel encodes everything: color, size, glow, labels, motion,
and edges all compete.

Success: every channel has a job:

- Brightness: importance.
- Color: community/semantic identity.
- Size: rank.
- Glow: focus/energy.
- Labels: explicit meaning.
- Motion: attention and transition.

## Cosmic Quality Stack

Render the graph as perceptual layers, not as one kind of primitive:

1. Void: black or near-black negative space.
2. Density mist: low-res, soft aggregate mass.
3. Micro-stars: sparse texture points.
4. Cluster grains: slightly larger local-color marks.
5. Anchor nodes: sharp, ranked, stable exact points.
6. Relationship filaments: sampled/bundled/atmospheric edges.
7. Hero semantics: selected path, hover, labels, halos.
8. Post: tone mapping, restrained bloom, grain/dither, temporal stability.

## Per-Tile Controls

The renderer should evolve toward a GPU-side perceptual controller:

```ts
type PerceptualQualityConfig = {
  targetTileOccupancy: number
  maxTileSaturation: number
  maxLocalHueVariance: number
  minHeroSeparationPx: number
  maxDustAlpha: number
  maxEdgeAlpha: number
  bloomBudgetPerTile: number
  heroBudgetPerTile: number
  labelBudgetPerTile: number
  motionBudgetPerTile: number
}
```

Tile states to expose in a debug overlay:

- `EMPTY`
- `GOOD_DUST`
- `GOOD_CLUSTER`
- `MUD`
- `OVERBRIGHT`
- `TOO_RAINBOW`
- `ALIASING_RISK`
- `SEAM_RISK`

## Engine Rules

### Preserve Local Maxima

In a dense tile, keep the brightest or most important nodes discrete. Collapse
the rest into density. The viewer should see exact anchors embedded in believable
mass.

### Never Let Density Become Full White Except Heroes

Density should be tone-mapped:

```
densityBrightness = log(1 + density)
heroBrightness = explicit rank / focus / selection
```

### Keep Color Local

Each cluster should have a coherent palette. Local color variance should be
controlled so communities feel organized rather than random.

### Use Dark Moats Sparingly

Moats should protect hovered nodes, selected nodes, dense-tile anchors, labels,
and top landmarks. They should not wrap every dust particle.

### Quantize Size Bands

Use a small visual ladder:

- dust
- small
- normal
- large
- anchor
- hero

Continuous arbitrary size variation tends to look noisy.

### Keep Dense Edges Below Nodes

Node core luminance should generally dominate edge luminance. Dense edges should
create texture and direction, not overpower the graph.

### Hide Implementation Boundaries

No visible tile seams, no hard LOD thresholds, no per-frame random sampling, no
white washout, and no label/halo popping.

## Next Renderer Outcome

Build Perceptual Renderer v0:

1. GPU tile stats: count, energy, saturation, max salience, subcell occupancy,
   and optional color coherence.
2. Tile budget/classification pass: choose exact anchors, micro-stars, density,
   and suppression per tile.
3. GPU compaction: produce draw lists for anchors and micro-stars without CPU
   readback.
4. Low-res density mist: tone-mapped mass layer with no full-white washout.
5. Stable anchor preservation: deterministic local maxima with hysteresis.
6. Debug overlay: show tile classes, visible counts, anchor counts, density
   saturation, and pass timings.

Acceptance criteria:

- Zoomed-out dense views look structured, not blocky or muddy.
- Dense clusters preserve dark gaps and sharp local maxima.
- White-hot bloom is rare and intentional.
- Panning/zooming does not shimmer or pop.
- Tile boundaries are not perceptible.
- Exact focus/selection remains readable above aggregate layers.

## Research Note: Learned Splatting

Hu et al., "Low Latency Point Cloud Rendering with Learned Splatting"
(CVPRW 2024) is relevant to Kajillion's perceptual renderer direction:

<https://openaccess.thecvf.com/content/CVPR2024W/AI4Streaming/papers/Hu_Low_Latency_Point_Cloud_Rendering_with_Learned_Splatting_CVPRW_2024_paper.pdf>

The useful lesson is not that Kajillion should immediately add a neural network.
The useful lesson is that high-quality point rendering often needs adaptive
splats, not fixed-size dots. Their system converts irregular points into
elliptical Gaussian primitives with center offset, covariance, orientation, and
opacity, then splats them in screen space. This directly supports Kajillion's
planned shift from "all circles" to a shape/representation ladder.

Practical steal for Kajillion:

- Use moment-preserving elliptical splats for dense tiles.
- Estimate centroid, covariance, dominant color, opacity, and energy per tile or
  local cell.
- Keep exact anchor nodes on top of the splat so dense regions still contain
  real selectable structure.
- Avoid per-scene training initially; compute ellipses from tile/local moments.
- Treat a learned or offline model as a future enhancement only after the
  hand-built GPU tile controller proves the visual model.

This paper reinforces the point that fixed global splat parameters cause either
holes, blur, or noisy edges. Kajillion's equivalent failure is fixed global node
rendering causing either sparse fake views, dense mud, or shimmer. Adaptive
elliptical splats are the next serious representation to test.

## Research Note: deck.gl Aggregation Layers

deck.gl's aggregation layers are directly relevant to Kajillion's density layer:

<https://deck.gl/docs/api-reference/aggregation-layers/overview>

deck.gl treats large point sets as alternative aggregate representations:
grid/hex bins, contours, screen grids, and heatmaps. The key lesson is that
density is a first-class visualization, not a fallback for failed point
rendering.

The most relevant deck.gl layer for Kajillion is `HeatmapLayer`:

<https://deck.gl/docs/api-reference/aggregation-layers/heatmap-layer>

It performs GPU aggregation and uses Gaussian kernel density estimation. Its
core controls map almost one-to-one to Kajillion needs:

- `radiusPixels`: how far each point contributes mass.
- `intensity`: exposure / brightness gain.
- `threshold`: low-density fade and blob boundary behavior.
- `colorRange` / `colorDomain`: tone/color mapping of aggregate weight.

Practical steals for Kajillion:

- Treat the density/mist pass as an explicit layer with radius, intensity,
  threshold, and color-domain controls.
- Keep aggregation on the GPU for large data. deck.gl's docs note that CPU
  aggregation is linear in input size, while GPU aggregation has setup/upload
  overhead but low marginal cost as data grows.
- Use GPU filtering with aggregation when possible. deck.gl's
  `DataFilterExtension` is a useful reference for keeping filter state in GPU
  attributes instead of filtering arrays on the CPU.
- Accept that GPU aggregate output does not expose exact member lists per bin.
  Exact picking/selection should come from the anchor/focus layers, not the
  density layer.
- Prefer screen-space aggregation for overview perceptual quality, because the
  artifact we are managing is pixels, not world units.

What not to copy directly:

- Do not import deck.gl as the hot renderer. Kajillion already has a WebGPU
  renderer and needs custom graph semantics, exact anchors, edge layers, and
  tile-state feedback.
- Do not stop at heatmap blobs. Heatmap alone is the "fog" failure mode. It must
  be combined with stable anchors, micro-stars, hierarchy, tone mapping, and
  semantic focus.
- Do not expose aggregate cells as selectable graph truth. Aggregates are visual
  mass; selectable nodes remain exact entities.

The deck.gl model supports the Perceptual Renderer v0 direction:

```
exact graph data
  -> GPU aggregate density layer
  -> tone-mapped mist
  -> exact anchors / focus nodes on top
  -> labels and selected relationships
```

This should be implemented as a custom WebGPU pass using deck.gl's aggregation
API as conceptual prior art, not as a dependency.

Implementation slice added:

- `impostorMassRadiusScale`: screen-space density radius control.
- `impostorMassThreshold`: low-density cutoff to prevent whole-screen fog.
- `impostorMassMaxAlpha`: per-splat brightness/opacity budget.
- `impostorMassColorBoost`: luminance boost without increasing opacity.
- `impostorMassExtrusion`: optional pseudo-terrain lift for tilted/gallery
  density views.

These controls turn the existing tile-impostor path into an explicit heatmap
mass layer while keeping exact anchors and focus nodes as the selectable graph
truth.
