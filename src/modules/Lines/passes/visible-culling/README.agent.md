# Lines visible culling pass

Purpose:
- Own the WebGPU visible-line culling lifecycle for indirect line drawing.
- Keep culling buffers, compute pipelines, active-mask cache, and indirect draw glue together.

Important files:
- `contracts.ts`: clear/cull uniform payloads and binding layouts.
- `visible-line-culling-pass.ts`: visible-index buffers, active-mask upload cache, compute dispatches, and indirect draw.

Invariants:
- Compute binding names and locations must mirror `CLEAR_VISIBLE_LINE_BINDINGS` and `CULL_VISIBLE_LINE_BINDINGS`.
- The pass may own culling/indirect buffers, but caller-owned line attribute buffers stay outside this island.
- `prepare()` only returns true after clear and cull compute passes have run for the current frame.
- `draw()` must use the prepared indirect buffer and must not allocate per frame.

Verify:
- `npm run build`
