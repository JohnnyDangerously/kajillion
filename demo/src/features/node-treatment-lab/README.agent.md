# features/node-treatment-lab

Purpose:
- Own demo-only node treatment lab contracts, presets, palettes, and bounded helper logic.
- Keep `demo/src/node-treatment-lab.ts` as the DOM/canvas initializer used by the demo shell.

Important files:
- `types.ts`: public lab state, treatment, palette, and node contracts.
- `presets.ts`: default lab state, treatment metadata, and palette data.

Invariants:
- Keep rendered treatments visually unchanged unless the task explicitly asks for visual changes.
- Preset/data helpers do not import DOM state or canvas rendering code.
- The legacy `demo/src/node-treatment-lab.ts` entrypoint remains the only initializer imported by the demo shell.

Verify:
- `npm run demo:build`
