# features/gallery-presets

Purpose:
- Own demo-only gallery preset parsing, URL defaults, graph layout presets, color palettes, and gallery-only CSS skins.
- Keep the legacy `demo/src/gallery-presets.ts` and `demo/src/gallery-presets.css` files as compatibility barrels for existing imports.

Important files:
- `types.ts`: public gallery preset contracts.
- `url-defaults.ts`: palette parsing and URL default maps.
- `render-data.ts`: palette-to-scene dispatch.
- `colors.ts`: particle, link, and display color helpers.
- `*.ts` preset modules: family-specific graph layouts and label anchors.
- `styles/*.css`: gallery-only theme, label, and preview skins.

Invariants:
- Do not import `demo/src/main.ts` state from this feature; helpers take explicit inputs.
- Preserve exports from `demo/src/gallery-presets.ts` unless all downstream imports are updated in the same change.
- Keep gallery-only CSS reachable through `demo/src/gallery-presets.css`.
- Do not edit package files, `demo/index.html`, or `src/modules/*` from this feature.

Verify:
- `npm run demo:build`
