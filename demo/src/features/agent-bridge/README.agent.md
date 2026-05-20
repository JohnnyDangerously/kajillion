# features/agent-bridge

Purpose:
- Own demo-only agent command/API bridge contracts and pure parser/conversion helpers.
- Keep `demo/src/main.ts` focused on live graph state, DOM state, and render calls.

Important files:
- `types.ts`: agent graph payload and command envelope contracts.
- `graph-payload.ts`: conversion from agent graph payloads into `GeneratedGraph`.
- `append-edges.ts`: pure buffer growth helper for streamed `appendEdges` commands.
- `command-loop.ts`: polling, ack, and `window.__kajillionAgent` protocol wiring.

Invariants:
- Do not instantiate `Graph` or reach into live `main.ts` state from this feature.
- Helpers should take explicit inputs and return data for `main.ts` to apply.
- Keep demo sizing explicit; payload conversion receives `spaceSize` from the caller.
- Do not edit package files, `demo/index.html`, `src/config*`, or `src/modules/*` from this feature.

Verify:
- `npm run demo:build`
