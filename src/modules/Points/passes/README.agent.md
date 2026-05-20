# Points passes

Purpose:
- Own small pass-local contracts and pure configuration helpers for the Points renderer.

Important files:
- `shared/constants.ts`: immutable fallback vectors and shared numeric constants.
- `shared/contracts.ts`: cross-pass WebGPU/timer access shims.
- `draw/contracts.ts`: draw, picking, tracking, and position-update uniform payload contracts.
- `impostors/contracts.ts`: density, tile impostor, and hybrid-anchor uniform payload contracts.
- `impostors/config.ts`: pure tile impostor sizing and sampling helpers.
- `visible-culling/activeMask.ts`: pure active-point mask signatures, cache predicates, and mask payload construction.
- `visible-culling/contracts.ts`: visible-point culling and tile-budget uniform/layout contracts.
- `visible-culling/config.ts`: pure visible-point tile-budget layout helper.

Invariants:
- WGSL/GLSL binding names, uniform field names, and declaration order stay unchanged.
- Shader source files remain in `src/modules/Points/` unless a move is import-path neutral.
- Helpers in this folder are pure or type-only; per-frame allocation stays in `index.ts`.

Verify:
- `npm run build`
