# features/ui-state

Purpose:
- Own demo-only UI state projection helpers that are independent of graph mutation.
- Keep `demo/src/main.ts` focused on event wiring and live `Graph` calls.

Important files:
- `mode-readout.ts`: toggle labels and mode readout text projection.
- `work-focus-panel.ts`: work focus panel text and button-state projection.

Invariants:
- Do not instantiate or mutate `Graph` from this feature.
- Keep DOM IDs defined in `features/control-plane/dom.ts`; this feature may receive those typed element groups.
- Helpers should take explicit config/data/state inputs instead of reaching into `main.ts`.
- Preserve existing visible labels and separators.

Verify:
- `npm run demo:build`
