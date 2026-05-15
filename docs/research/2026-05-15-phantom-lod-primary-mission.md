# Phantom LOD Primary Mission

## Goal

Make large Kajillion graphs feel exact, massive, and beautiful while drawing far
fewer primitives than a naive renderer. The user-facing target is not "LOD is
enabled"; it is "I cannot tell where exact rendering ends."

## Architecture

Use a continuous three-layer renderer:

1. **Mass layer.** Screen-space aggregate density carries the visual weight of
   dense regions before every individual node is drawn. This layer must be soft
   support, not visible blocks.
2. **Anchor layer.** Stable exact nodes are preserved inside dense regions so
   the eye still sees real graph texture. Anchors should be deterministic and
   should not churn during slow pan/zoom.
3. **Focus layer.** Hovered, selected, searched, labeled, and nearby semantic
   nodes remain exact. Focus edges remain exact; distant edges can be sampled,
   bundled, or eventually aggregated.

The core rule is visual mass conservation: when exact nodes disappear into an
aggregate, the aggregate gains only the missing perceived luminance. When exact
nodes reappear, the mass layer gives that luminance back.

## Current Slice

- GPU culling exists for points and lines.
- The early WebGPU tile-bin path exists for point mass.
- Demo large-graph LOD now actually enables `renderLodMode: 'auto'` when the
  LOD/phantom toggle is active.
- The demo cosmo layout now uses organic community seed positions so exact mode
  is not square-packed before LOD starts. Benchmark generation remains on the
  original default layout for apples-to-apples comparisons.
- Tile impostor minimum alpha was removed so the mass layer can become truly
  faint instead of forcing visible haze.

## Next Required Engine Work

1. Replace visible tile micro-splats with moment-preserving elliptical splats:
   count, centroid, covariance, color summary, opacity from luminance integral.
2. Add stable per-tile anchor selection that favors labels, focus, degree, and
   deterministic spatial representatives.
3. Add occupancy-based mixed mode with hysteresis instead of relying mostly on
   point count and zoom thresholds.
4. Add frame metrics for exact node count, splat count, max/p95 tile occupancy,
   anchor churn, and aggregate pass time.
5. Add edge LOD after the point layer is stable: stable stochastic edge sampling
   first, tile-pair ribbons only if exact sampled edges still look too noisy.

## What To Avoid

- Hard exact/impostor switches.
- Visible tile-shaped quads.
- CPU-side LOD decisions.
- Per-frame random sampling.
- Letting temporal filtering hide unstable core logic.
- Making distant aggregates brighter than the exact graph they replace.
