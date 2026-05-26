# Atlas Reference Representation

URL id: `rep=atlas-reference`

This URL is currently a compatibility alias for the 3D `reference-cloud`
renderer. The prior black-background atlas overlay is disabled because its
texture and packing passes flattened the graph into island rows.

## Shape

- `preset.ts`: aliases this representation id to `reference-cloud`.
- `layout.ts`: legacy atlas island coordinates, not active from this preset.
- `style.ts`: legacy fallback GPU point colors/sizes, not active from this
  preset.
- `overlay.ts`: legacy 2D canvas renderer, kept disabled from this preset.
- `overlay-geometry.ts`: legacy atlas draw point generation with packing and
  texture disabled.

## Visual Contract

Keep this URL aligned with the reference-cloud visual direction:

- black background
- saturated local colors
- visible black moat/rim around important dots
- previous 3D/depth network-cloud composition
- no random texture points
- no packed bead-pile clusters
- no fake flat island rows

Do not re-enable the atlas overlay without an explicit design reversal.
