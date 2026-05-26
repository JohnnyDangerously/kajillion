# Neon Glass Representation

URL id: `rep=neon-glass`

This is the original headshot/photo-wall experiment. It renders image-backed
points through the graph runtime image-atlas path and owns its own bloom
animation controls.

## Assets

- `/headshots/manifest.json`
- `/headshots/atlas-128.webp`

The manifest currently describes about 1k entries. The loader slices the atlas
into circular `ImageData` cells with a painted colored ring before passing them
to `graph.setImageData` and `graph.setPointImageIndices`.

## Shape

- `preset.ts`: owns camera, graph config, bloom lifecycle, and image install.
- `headshot-loader.ts`: decodes and slices the atlas once.
- `layout.ts`: produces the concentric-ring headshot layout.
- `style.ts`: provides non-image fallback colors and sizes.
- `bloom-*`: animation variants and local controls.

Do not merge this with `neon-network`; this is the smaller art/headshot wall.
