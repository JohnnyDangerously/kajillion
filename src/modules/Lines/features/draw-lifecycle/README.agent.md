# Lines draw lifecycle

Purpose:
- Own pure draw/precompute/culling lifecycle helpers for the Lines renderer.
- Keep GPU resource ownership and pass ordering in `src/modules/Lines/index.ts`.

Important files:
- `lifecycle.ts`: line LOD, segment, hover scissor, and active-mask helper logic.

Invariants:
- Helpers in this folder must be pure or mutate caller-provided scratch buffers only.
- Do not create WebGPU/WebGL resources here.
- Do not add per-frame allocations beyond allocations already present at the call site.
- Shader binding names, uniform names, and pass order remain owned by the pass contracts and `index.ts`.

Verify:
- `npm run build`
