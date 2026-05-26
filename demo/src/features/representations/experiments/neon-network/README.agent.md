# Neon Network Representation

URL id: `rep=neon-network`

This is the larger real-network people-image representation. It is likely the
"third version" that loaded many people images into a beautiful graph display.
It should be protected as its own experiment.

## Assets

- `/network/john-2hop.bin`: precomputed 2-hop positions and scores.
- `/network/manifest.json`: source person manifest.
- `/network/photo-manifest.json`: render-index to photo-atlas mapping.
- `/network/atlas-128.webp`: combined image atlas.

Current asset facts:

- network node count: 19,074
- photo atlas cells: 3,824
- atlas cell size: 128 px

## Shape

- `network-loader.ts`: loads the binary network into typed arrays.
- `atlas-loader.ts`: slices the photo atlas into circular `ImageData` cells and
  returns per-render-index image slots.
- `style.ts`: applies hop/score/photo-aware visual attributes.
- `preset.ts`: owns the camera, hides work labels, swaps in real positions, and
  installs the atlas through the GPU point-image runtime.

Keep this representation independent from atlas-style macro rendering. Its value
is real-person image rendering plus network semantics, not a generic color-dot
layout.
