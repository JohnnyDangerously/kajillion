# features/ui-state/label-overlay

Purpose:
- Own demo-only cluster label projection helpers.
- Keep `demo/src/main.ts` responsible for DOM elements, animation frames, and live `Graph` calls.

Invariants:
- Do not instantiate or mutate `Graph` from this feature.
- Preserve label text, anchor math, and palette-specific behavior unless the visual spec changes.
- Take explicit config/data inputs instead of reading `main.ts` state.

Verify:
- `npm run demo:build`
