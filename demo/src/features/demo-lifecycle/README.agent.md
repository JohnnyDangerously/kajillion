# features/demo-lifecycle

Purpose:
- Own demo-only graph lifecycle helpers that can stay pure and explicit.
- Keep `demo/src/main.ts` focused on wiring live graph state, DOM events, and render calls.

Important files:
- `work-graph-types.ts`: work graph metadata contracts and shared work-group constants.
- `work-graph-generator.ts`: demo work graph construction and metadata attachment.
- `work-graph-layout.ts`: deterministic work graph placement, overlap, and organic layout helpers.
- `render-data.ts`: frame-to-render-data helpers and work metadata transfer.

Invariants:
- Do not instantiate `Graph` or reach into live `main.ts` state from this feature.
- Helpers should take explicit inputs and return data for `main.ts` to apply.
- Keep render-loop behavior and DOM element IDs outside this feature.
- Do not edit package files, `demo/index.html`, `src/config*`, or `src/modules/*` from this feature.

Verify:
- `npm run demo:build`
