# features/graph-control-plane

Purpose:
- Own the demo's graph interaction control plane: snapshot summaries, node focus,
  node filters, edge-kind visibility, and analytics-worker RPC.

Important files:
- `control-plane.ts`: public facade assembled from explicit graph accessors.
- `visual-lab-control-types.ts`: public control-plane contracts.
- `visual-lab-worker-rpc.ts`: analytics worker request/response plumbing.
- `visual-lab-snapshot-summary.ts`: pure graph snapshot summary projection.

Invariants:
- Rendering lifecycle and graph mutation stay owned by `demo/src/main.ts`.
- Worker RPC stays async and request-id guarded.
- `demo/src/visual-lab-control-plane.ts` remains a compatibility barrel for old imports.
- Helpers must not import DOM controls or renderer internals directly.

Verify:
- `npm run demo:build`
