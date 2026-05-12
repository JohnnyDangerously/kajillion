# Session log — 2026-05-12 (session 2)

Continuation of [2026-05-12-session-log.md](./2026-05-12-session-log.md).
That session ended at ~50 fps at n=100k on M5 Max sim+render, with
force.link.{incoming,outgoing} dominating at ~25 ms each. This session
attacks both the remaining sim cost and the render cost.

## Headline

**n=100k WebGPU sim+render on M5 Max landed in the 30–43 fps band**
(thermal-noisy; cold runs near the top, hot runs near the bottom). The
force.link.outgoing pass went from ~25 ms → 0.1 ms (~230× faster) via
a compute-shader port. render.points dropped 38% from a fragment-shader
corner-discard. 4× MSAA shipped behind a config flag for screenshot-
quality work at small n.

## Shipped commits

```
738fd91  bench: linkWidthScale URL param for vertex-vs-fragment-bound bisection
4ddb299  feat(render): opt-in 4× MSAA via hand-rolled canvas pass
1d656ab  perf(points): fast corner-discard for the no-image circle case (-38% render.points)
b88d35d  perf(forcelink): compute-shader port — ~25 ms → <1 ms per pass
a9e2c3c  scaffold(lines): WGSL for per-instance compute pre-pass
```

## Per-pass numbers (Chrome 148, M5 Max, DPR=2, n=100k sim+render)

| Pass                  | Session 1 end | This session (cold) |
|-----------------------|---------------|----------------------|
| force.gravity         | <0.01         | <0.01                |
| force.repulsion       | ~1.5          | ~6.5                 |
| force.link.incoming   | ~25           | 0.5                  |
| force.link.outgoing   | ~25           | 0.1                  |
| render.lines          | ~10           | 11–18                |
| render.points         | ~7            | 8–12                 |

Note: the force.repulsion number rose from session 1's 1.5 ms to this
session's 6.5 ms. Same code, same dataset — the difference is thermal
state and Mac power gating between sessions. The 1.5 ms was a cool-Mac
reading; 6.5 ms is the typical sustained number. Both have been observed
on this hardware.

## Architectural changes

- **Compute-shader port of force-spring** — `src/modules/ForceLink/force-spring.compute.wgsl.ts`.
  One thread per point in an 8×8 workgroup tile, dispatched as ceil(n/8)²
  workgroups. Body identical to the fragment version (textureLoad-only,
  no samplers). Writes velocity via `texture_storage_2d<rgba32float, write>`
  into the same `velocityTexture` that the rest of the force passes
  share. `points.velocityTexture` usage was extended to include
  `Texture.STORAGE` (WebGL2 ignores the flag).

- **Hand-rolled MSAA canvas pass** — `src/render/msaa-target.ts`. luma.gl
  9.2.6's `RenderPass` abstraction doesn't expose `resolveTarget`, so we
  bypass it: own the multisample GPUTexture, build the descriptor with
  `view = msaaView, resolveTarget = canvasView, storeOp: 'discard'`, and
  call `commandEncoder.beginRenderPass(...)` directly. Wrapped in a
  minimal pass-shaped object that satisfies what `Model.draw(pass)` needs
  structurally (`.handle`, `pushDebugGroup`, `popDebugGroup`, `end`).
  MSAA-on flips lines/points/highlighted into a single combined pass
  (single resolve), at the cost of merging two timestamp slots into one
  `render.canvas`.

- **Points corner-discard** — circle points without image or outline
  cover only the inscribed disk; the four corners (~21% of every quad)
  produce zero-opacity output. Early-discard before the rest of the
  fragment shader runs. 38% wallFps boost at n=100k.

- **WebGPU compute-pass timestamp instrumentation** — extended the
  `TimerQueryPoolWebGPU` interceptor to hook `device.beginComputePass` in
  addition to `device.beginRenderPass`. The compute force.link passes
  now get per-pass GPU timings the same way render passes do.

- **luma.gl 9.2.6 occlusionQuerySet misroute patch** — extended to also
  fix `dist/dist.dev.js` and `dist/index.cjs` in addition to the
  previously-patched modular dist. The modular dist was patched in
  session 1 but bundlers can resolve to either; the additional patches
  close the gap.

## Things tried that didn't bank

- **MSAA at n=100k** — works correctly, but at ~4× cost vs no-MSAA (78 ms
  render.canvas vs ~19 ms total at non-MSAA). Apple Silicon's tile-resident
  multisample texture is fast for sparse single-layer geometry but
  expensive when heavily-overlapped translucent primitives force per-
  sample coverage evaluation and pressure tile memory. Ship as opt-in.

- **Intrinsic micro-opt on force-level.wgsl** — collapsed
  `c / sqrt(l) * normalize(d)` into a single inverseSqrt. WGSL compiler
  already does this; no measurable change in force.repulsion time.
  Confirmed force.repulsion is bandwidth-bound (14 levels × ~48 cell
  texture-sample iterations × N points texels), not arithmetic-bound.
  Reverted.

- **Line fragment early-discard** — the line strip quad coords range
  [-0.5, 0.5] which never extend past the smoothstep AA edge, so there's
  nothing to discard analogous to the points corner-discard.

- **Render bundles for the canvas pass** — luma.gl 9.2.6 has them only
  as commented-out TODO. Would require a parallel hand-rolled pipeline
  abstraction (similar to MSAA). Modest expected gain on a TBDR GPU.
  Deferred.

## Scaffolded but not landed

- **Per-instance compute pre-pass for lines** — `src/modules/Lines/precompute-line-instances.compute.wgsl.ts`.
  WGSL is complete and reviewed for math-correctness against the legacy
  vertex shader. Integration (convert six per-instance vertex buffers
  to dual-usage VERTEX|STORAGE, ComputePipeline + storage buffer in
  Lines/index.ts, swap vertex shader to read packed LineInstance entries
  by `@builtin(instance_index)`, dispatch before canvas pass) is the
  next session's first move. Vertex-vs-fragment-bound bisection showed
  lines are mixed-bound: thin lines (linkWidthScale=0.1) take 49 ms;
  thick lines (linkWidthScale=8) take 82 ms. Vertex baseline ~30–50 ms,
  rest is fragment overdraw. Pre-pass should clip the vertex portion.

## Open / next-session work

In rough priority:

1. **Finish integrating `precompute-line-instances.compute.wgsl.ts`** —
   wire the storage buffers + ComputePipeline + thin vertex shader.
   Best estimate: 3–4 ms saved on render.lines at n=100k; bigger at
   higher densities. ~3 hours.

2. **Compute-consolidation of force.repulsion** — keep the existing
   per-level math, merge the 14 separate render passes into 1 compute
   pass that loops levels in registers. The math is bandwidth-bound
   so the gain is mainly per-pass encoder + bind-group overhead.
   Probably 1–2 ms. ~3 hours.

3. **Hierarchical LOD / supernodes** — the only thing that buys 10M+
   viability. 2–4 weeks. Sigma.js v4 roadmap parallels this; deck.gl
   already ships `ClusterTileLayer`.

4. **Top-K links per tile** — caps density at zoomed-out views.
   Attacks the fragment-overdraw portion of render.lines specifically.
   ~1 day.

5. **File the 4 luma.gl bugs upstream** — `docs/luma-gl-upstream-issues.md`.
   ~30 min.

## Reference points

- The compute force.link port confirmed the broader thesis from session 1:
  WebGPU compute is enormously faster than fragment-shader force passes
  for inherently parallel per-point work. force.link.outgoing went from
  ~25 ms (fragment) to ~0.1 ms (compute), a ~230× speedup with no algorithmic
  change. The same pattern should apply to force.repulsion's 14-level Barnes-
  Hut loop, but the bandwidth ceiling there limits the win to encoder-
  overhead savings rather than the order-of-magnitude jump we saw on force.link.

- GraphGPU survey: zero packed math / fma / subgroup ops / f16 in their
  shaders. SDF circles + AA edge quads + instanced draws are the same
  techniques we ship. Their compute layout is a naive N² brute force
  (no Barnes-Hut on GPU despite the README claim). The only useful steal
  was their MSAA descriptor pattern with `storeOp: 'discard'`, which is
  what shipped this session.
