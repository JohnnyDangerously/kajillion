# Config Contracts

Purpose:
- Own graph configuration contracts, defaults, and derived runtime helpers.

Important files:
- `schema.ts`: stable public `GraphConfigInterface` and `GraphConfig` contract.
- `render-lod-depth.ts`: render, LOD, impostor, and depth-cue config contract/default fragment.
- `simulation.ts`: simulation config contract/default fragment.
- `defaults.ts`: ordered `defaultConfigValues` assembly plus internal config constants.
- `validation.ts`: compile-time default-shape helpers.
- `derived.ts`: fresh default creation and in-place config mutation helpers.

Invariants:
- `src/config.ts` remains the compatibility barrel for public config imports.
- `src/variables.ts` keeps exporting `defaultConfigValues` and ring opacity constants.
- `defaultConfigValues` key order should remain stable because it is public.
- Runtime helpers must clone array defaults when creating or resetting config objects.

Verify:
- `npm run build`
