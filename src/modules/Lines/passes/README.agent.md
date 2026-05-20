# Lines passes

Purpose:
- Own small pass-local contracts, immutable fallbacks, and shader binding layouts for the Lines renderer.

Important files:
- `shared/constants.ts`: immutable fallback vectors and shared numeric constants.
- `shared/contracts.ts`: cross-pass WebGPU/timer access shims.
- `draw/contracts.ts`: draw-pass uniform payload and WGSL uniform type contracts.
- `hover/contracts.ts`: hovered-link uniform payload and WGSL uniform type contracts.
- `sampling/contracts.ts`: sampled-link uniform payload and WGSL uniform type contracts.
- `visible-culling/contracts.ts`: visible-line culling uniform payloads and WebGPU binding layouts.
- `precompute/contracts.ts`: precomputed line-instance uniform payload and WebGPU binding layout.

Invariants:
- WGSL/GLSL binding names, uniform field names, and declaration order stay unchanged.
- Shader source files remain in `src/modules/Lines/` unless a move is import-path neutral.
- Helpers in this folder are constants or type-only contracts; per-frame allocation stays in `index.ts`.

Verify:
- `npm run build`
