# Lines precompute pass

Purpose:
- Own the WebGPU line-instance precompute lifecycle for curved line drawing.
- Keep the packed instance-buffer contract close to its compute bindings.

Important files:
- `contracts.ts`: uniform payload and binding layout for `precompute-line-instances.compute.wgsl.ts`.
- `line-instance-pass.ts`: buffer, shader, pipeline, uniform-store, and compute dispatch lifecycle.

Invariants:
- `LINE_INSTANCE_BYTE_LENGTH` must match the WGSL `LineInstance` layout.
- Binding names and locations must mirror `PRECOMPUTE_LINE_INSTANCES_BINDINGS`.
- The pass reuses caller-owned attribute buffers; it must not create CPU-side per-frame copies.
- Keep this pass off unless curved/bundled line rendering actually needs it.
- Do not add debug/readback or CPU materialization to this pass without an
  explicit performance gate and timing evidence.
- The render model stays owned by `src/modules/Lines/index.ts`.

Verify:
- `npm run build`
