# Points draw pass helpers

Purpose:
- Own pipeline-independent draw lifecycle helpers for `src/modules/Points/index.ts`.

Important files:
- `contracts.ts`: draw, picking, tracking, and position-update uniform payload contracts.
- `lifecycle.ts`: scratch uniform initializers, draw-layer flags, payload fillers, and small draw-state predicates.
- `render.ts`: public point render pass helpers, including main draw binding refresh, layering, and point rings.
- `setup.ts`: draw UniformStore and Model setup helpers used by `Points.initPrograms()`.

Invariants:
- Helpers in this folder own draw-specific UniformStore and Model construction, while `Points` retains resource lifetime and draw ordering.
- Hot-path uniform helpers mutate caller-owned scratch payloads instead of returning fresh payload objects.
- Draw order lives in this folder; resource binding cache ownership stays in `src/modules/Points/index.ts`.

Verify:
- `npm run build`
