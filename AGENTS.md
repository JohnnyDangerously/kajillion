# Kajillion Agent Guidance

Kajillion is a high-performance WebGPU graph renderer with a demo/product shell
around it. Treat the codebase as two different systems:

- `src/graph` and `src/modules`: hot render/simulation path.
- `demo/src/features`: product orchestration, visual policy, agent APIs, and
  workflows that compile down into renderer inputs.

## Performance Doctrine

- Keep the hot path boring: typed arrays, GPU buffers, stable resource lifetimes,
  compact uniforms, WGSL, and bounded dispatch/draw passes.
- TypeScript is fine for orchestration, config, feature policy, data loading, and
  agent-facing control APIs. It must not become a per-frame object factory.
- Default expensive features to off. Enable them only through explicit config,
  zoom stage, focus state, or render policy.
- Do not add React, DOM, JSON rule evaluation, object graph traversal, or broad
  dependency work to per-frame graph primitives.
- Prefer precomputed buffers, dirty ranges, and small policy overlays over
  repeated CPU-side recomputation.
- Visual quality effects must preserve frame pacing. If an effect needs a
  second pass, it needs a clear budget, a disable path, and a cheap fallback.

## Product Split

- Galaxy/mega view owns vastness, macro LOD, density, and high-intensity visual
  impressions.
- Work Mode owns local graph workflows: zoom stages, focus, filtering, node
  hopping, side panels, and A-to-B camera choreography.
- Keep Work Mode policy in `demo/src/features/work-mode`; generic demo config
  should delegate there instead of collecting more `isWork` branches.
- Keep agent command APIs in small feature islands. They should convert commands
  into explicit graph/data operations, not reach into renderer internals.

## File Shape

- Keep source files small and searchable. The source-size check currently enforces
  files at or below 190 lines.
- Add local `README.agent.md` and `feature.agent.json` notes for new feature
  islands or render passes.
- Split by ownership and runtime cost, not by arbitrary function count.

## Verification

Run the narrow gate for normal edits:

```sh
npm run verify:fast
```

For demo/product changes, also run:

```sh
npm run demo:build
```

For render/package changes, run the broader gate before finalizing:

```sh
npm run verify
```
