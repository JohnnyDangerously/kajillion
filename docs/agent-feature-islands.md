# Kajillion Agent Feature Islands

This repo is moving toward small, agent-editable islands. Prefer adding or
changing code inside the nearest island before widening scope.

## Current Islands

- `src/config/`
  - Public graph config contracts, defaults, validation, and derived helpers.
  - Compatibility barrel: `src/config.ts`.
- `src/modules/Points/passes/`
  - Points renderer pass contracts and pure pass config helpers.
  - Hot renderer lifecycle still lives in `src/modules/Points/index.ts`.
- `src/modules/Lines/passes/`
  - Lines renderer pass contracts and pure pass constants.
  - Hot renderer lifecycle still lives in `src/modules/Lines/index.ts`.
- `demo/src/features/control-plane/`
  - Demo DOM control lookup, URL/control parsing, and perf overlay helpers.
- `demo/src/features/graph-control-plane/`
  - Demo graph interaction facade, snapshot summaries, and analytics-worker RPC.
  - Compatibility barrel: `demo/src/visual-lab-control-plane.ts`.
- `demo/src/features/demo-lifecycle/`
  - Demo render-data projection and work-graph lifecycle helpers.
- `demo/src/features/ui-state/`
  - Demo UI readouts and work focus panel projection.

## Rules

- Keep WebGPU TS/WGSL contracts close to the pass that owns them.
- Do not introduce per-frame allocations while extracting helpers.
- Compatibility barrels are allowed when they prevent churn in old imports.
- Each new island should include `README.agent.md`; add `feature.agent.json`
  when the island has public entrypoints or ownership boundaries.
- Use `npm run build` for library-renderer changes and `npm run demo:build`
  for demo-only changes.
