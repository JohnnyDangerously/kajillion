# Points position lifecycle

Purpose:
- Own CPU-side position lifecycle helpers that prepare point coordinates before GPU upload.

Important files:
- `rescale.ts`: initial point-position rescaling with the existing sparse/dense layout heuristic.

Invariants:
- Helpers mutate the caller-provided position array exactly as `Points.index.ts` did before extraction.
- Do not add GPU resources, shader bindings, or frame-loop work here.
- Preserve returned `scaleX` and `scaleY` functions because external point updates may reuse them.

Verify:
- `npm run build`
