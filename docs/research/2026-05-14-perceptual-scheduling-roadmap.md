# 2026-05-14 - Perceptual Scheduling Roadmap

This note captures the product/rendering direction: Kajillion's edge is not
only higher FPS or more triangles. The edge is perceptual scheduling: decide
what the viewer can notice, what they are attending to, and when a visual
change can safely happen.

Core mental model:

> Show the whole graph immediately as an impression, then progressively
> crystallize detail where attention lands.

That implies density before nodes, bundles before individual edges, clusters
before labels, halos before geometry, and attention-aware LOD before brute
force rendering.

## Product Thesis

The graph should not feel like it loaded more. It should feel like the user is
seeing deeper.

First frame should contain the whole graph as a believable aggregate:
density, cluster contours, edge-flow haze, major landmarks, and background
structure. Exact nodes and edges should emerge only where the viewer can
actually use them.

The renderer should preserve visual mass. If exact nodes appear, the density
field underneath should lose matching brightness. If edge bundles fan out into
individual curves, the bundle should dim by the same perceptual amount. If
labels arrive, the region should already have had a visual landmark.

## Visual Arrival Pipeline

The desired reveal ladder:

1. Render a blurred aggregate field: node density, cluster contours, edge-flow
   haze.
2. Reveal major clusters and bundled edges.
3. Reveal individual nodes in blue-noise spatial order, never row-by-row or
   chunk-by-chunk.
4. Sharpen attention regions: labels, precise edges, halos, outlines, hover
   affordances.

The guiding rule is mass conservation. Before individual nodes exist, their
contribution should already be visible as glow, density, edge haze, or cluster
texture. Detail should sharpen the scene, not change the scene.

## Change Cloaks

Use known perceptual blind spots as design tools:

- Change blindness: large changes can be missed during interruptions,
  transients, or attention shifts.
- Mudsplash-like local disruptions: small tasteful visual events can cloak
  unrelated local swaps.
- Motion silencing: hue, luminance, size, or shape changes are less noticeable
  while objects or camera are moving.
- Saccadic suppression: without eye tracking, approximate likely saccade
  windows after clicks, hover acquisition, cursor movement, zoom, and camera
  pans.

Concrete renderer rule:

Perform expensive or visible LOD swaps during motion, local shimmer, attention
ripples, zoom, or selection events. Stabilize after the swap is done.

The cloak should not look like loading. It should look like the graph is alive:
small glints, edge pulses, focus rings, density sparkles, or a subtle sweep.

## Semantic Foveation

Foveation should be semantic, not only geometric.

Highest detail:

- selected node
- hover path
- search result
- active community

Medium detail:

- immediate neighbors
- community boundary
- high-centrality nodes

Low detail:

- peripheral clusters
- background edge flow
- tiny nodes

Aggregate only:

- far background
- dense low-interest regions
- low-priority edges

Useful object priority score:

```text
perceptual_priority =
  data_importance
+ selection_distance
+ cursor_distance
+ viewport_center_weight
+ motion_state_bonus
+ search_match_bonus
- occlusion_penalty
- peripheral_distance
- overplot_density_penalty
```

This score should eventually choose node shader, label tier, edge
representation, radius, glow, and update frequency.

## Attention Texture

Build toward a screen-space attention texture, updated by compute. It can
combine:

- cursor and selection heat
- viewport center weight
- recent motion
- search results
- graph-theoretic importance
- interaction history
- regions with pending streamed detail
- high-contrast or already salient regions

GPU passes can read this texture to refine high-value regions first and defer
background detail.

## Million-Node Presence

The million-node graph should feel present through density, not exact geometry.
Treat it like a galaxy:

- clusters are nebulae
- high-degree nodes are stars
- edges are filaments
- selected paths are lightning
- labels are annotations, not clutter

LOD ladder:

| Tier | Representation |
|---|---|
| LOD 0 | density field only |
| LOD 1 | cluster blobs, contours, hulls |
| LOD 2 | bundled edge flows |
| LOD 3 | representative nodes |
| LOD 4 | individual node sprites |
| LOD 5 | selected nodes with SDF glyphs, labels, halos, exact edges |

## Edges As Flow

Edges are both a performance problem and a beauty problem. Far away, render
edge flow. Up close, reveal exact topology.

Desired behavior:

- Bundle far-away edges aggressively.
- Unbundle only near hover, selection, or search result.
- Draw curved, tapered, anti-aliased edges.
- Render edge density as controlled ink/glow accumulation.
- Fan edges out near selected nodes.
- Keep background edge saturation low enough that selected paths can sing.

The illusion: from far away, the graph is a flow field; up close, it is precise
topology.

## Color And Glow Rules

Do not use rainbow color as the beauty system.

Use:

- luminance for importance
- hue for category
- saturation for focus
- alpha for density/uncertainty
- glow for active energy

Reserve high saturation for semantic focus and important anchors. Background
detail should be lower saturation so selected objects have contrast headroom.
Light mode needs even more restraint: high-frequency saturated red/orange/pink
detail reads as flashing noise.

Glow should imply energy, not hide geometry:

- important nodes get an inner core plus soft outer aura
- dense clusters get low-frequency glow
- edges glow only where density accumulates
- selected paths get a stronger but bounded halo
- labels get a subtle outline, not a giant box

## Transition Rules

Transitions should preserve object identity.

- Clusters split from their centroid.
- Child nodes inherit parent color and luminance.
- Edge bundles fan out from existing bundles.
- Labels appear after local stability.
- Nodes do not teleport unless a visible transition explains it.
- Easing should feel critically damped: physical, not bouncy.

Preferred reveal:

```text
cluster blob -> cluster contour -> representative nodes -> child nodes -> labels
```

Motion is attention budget. Animate one selected path, one community, or one
focus ripple. Do not animate 200 meaningful things at once.

## No Pop-In Recipe

When a new chunk arrives:

1. Add its mass to the density field immediately.
2. Do not show individual nodes yet.
3. Wait for camera motion, cursor motion, cluster hover, zoom, selection
   ripple, or local shimmer.
4. During that event, instantiate nodes at low alpha and small/subpixel radius.
5. Reveal nodes in blue-noise spatial order.
6. Conserve total luminance: as nodes appear, reduce parent density glow.
7. Add exact edges only near focus; keep the rest bundled or aggregated.
8. Reveal labels only after 200-500 ms of local stability.

Step 6 is the critical one. If total brightness jumps, users notice. If a blob
loses brightness while exact detail gains brightness, the scene feels like it
sharpened.

## Target WebGPU Pass Shape

Compute:

- update node screen positions
- compute viewport visibility
- compute perceptual priority
- assign LOD tier
- update reveal state
- update cluster/density bins

Render A:

- low-res node density field
- low-res edge density/bundle field

Render B:

- bundled edges and flow lines
- anti-aliased tapered curves

Render C:

- instanced node sprites
- SDF circles, rings, icons, halos

Render D:

- labels and annotations
- label collision/priority mask

Postprocess:

- tone mapping
- restrained bloom/glow
- subtle sharpening
- temporal stabilization
- blue-noise dithering

## Immediate Projects

### P0. Visual Mass Conservation Crossfade

Outcome: exact detail can appear without a brightness jump.

Implement crossfade weights between density/impostor, representative nodes, and
exact nodes. When exact nodes fade in, aggregate density fades out by the same
perceived luminance. This directly targets pop-in and the flash reports.

Acceptance:

- Slow zoom/reveal shows sharpening, not brightness popping.
- Stationary camera has no shimmer.
- Light mode does not produce warm micro-flashes around dense clusters.

### P1. Stable Blue-Noise Reveal Order

Outcome: streamed or newly revealed exact nodes appear in spatially even,
deterministic order.

Use stable node/tile/zoom-band hashing or a blue-noise table. Do not reveal by
input order, buffer chunk, or screen tile order.

Acceptance:

- Reveals look like crystallization, not scanlines or chunks.
- Same camera path produces same reveal pattern.

### P2. Motion-Gated LOD Scheduler

Outcome: large visual swaps happen during camera/graph/focus motion, not during
still inspection.

Acceptance:

- LOD state can queue pending changes.
- Pending changes apply during pan, zoom, selection ripple, or local shimmer.
- After local stability, labels and exact detail settle without further churn.

### P3. Semantic Attention Texture

Outcome: GPU-side priority field drives which tiles/nodes/edges refine first.

Acceptance:

- Cursor/selection/search/viewport-center priority can be visualized.
- Node and edge LOD can sample the priority field.
- Focus regions refine before background regions at fixed budget.

### P4. Edge Flow Then Exact Fan-Out

Outcome: far edges render as bounded flow; focus edges fan out into topology.

Acceptance:

- Overview has low hair/noise.
- Selected neighborhoods show exact edges.
- Transition from flow to exact preserves identity and brightness.

## References To Ground Later

These are the research areas/sources to cite when turning this roadmap into
public or technical writing:

- Datashader: screen-space rasterization/aggregation for very large point sets.
- Rensink, O'Regan, Clark: change blindness.
- O'Regan, Rensink, Clark: mudsplashes.
- Suchow and Alvarez: motion silencing.
- Saccadic suppression and interaction-contingent attention shifts.
- Foveated rendering surveys: adaptive resolution, geometry, shading, and
  temporal quality by gaze/attention.
- Itti/Koch-style saliency maps as scheduling fields.
- Holten hierarchical edge bundling.
- GPU Gems glow/bloom and tone mapping.
- Helmholtz-Kohlrausch effect for perceived brightness of saturated colors.
- Crameri/viridis perceptual colormap guidance.
- Heer and Robertson on animated transitions preserving comprehension.
- Pylyshyn and Storm on limited multiple-object tracking capacity.

