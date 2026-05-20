# features/control-plane

Purpose:
- Own demo-only control parsing, DOM element lookup, and live perf overlay helpers.
- Keep `demo/src/main.ts` focused on graph lifecycle and data wiring.

Important files:
- `types.ts`: public demo control-plane config contracts.
- `controls.ts`: URL hydration, range parsing, tuning labels, and mode predicates.
- `dom.ts`: DOM element lookup grouped by overlay, controls, and focus panel.
- `perf-overlay.ts`: wall-FPS probe, GPU timing math, and overlay text rendering.

Invariants:
- Do not import graph data generation or rendering lifecycle code into this feature.
- Helpers should take explicit inputs instead of reaching into `main.ts` state.
- Keep the graph render loop in `main.ts`; this feature may update overlay text on its existing timer.
- Do not edit package files, `demo/index.html`, or `src/modules/*` from this feature.

Verify:
- `npm run demo:build`
