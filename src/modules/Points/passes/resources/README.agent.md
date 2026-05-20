# Points resource lifecycle

Purpose:
- Own concrete resource lifecycle helpers used by `src/modules/Points/index.ts`.

Important files:
- `lifecycle.ts`: live-destroy helper, shared fullscreen quad vertex data, byte-length preserving buffer writes, and texture/FBO recreate helpers.

Invariants:
- Helpers stay concrete to Points resource lifecycles; do not grow this into a generic GPU framework.
- `writeOrCreateBuffer` must preserve the existing byte-length reuse contract and only recreate on missing/destroyed/size mismatch.
- `writeOrCreateTexture` must keep texture usage and format explicit at the call site.
- No helper here may allocate during the draw hot path unless the old inline code already did.

Verify:
- `npm run build`
