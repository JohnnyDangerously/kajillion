# Session log — 2026-05-11 → 2026-05-12

## Headline

**WebGPU at n=100k went from 1.5 fps to ~50 fps** on M5 Max during this session.
The single biggest move was finding a silent bug in luma.gl 9.2.6 that
dropped user-provided `stepMode: 'instance'` on per-instance vertex
buffers — a ~60× speedup from a one-line patch.

## Shipped commits (in order)

```
564b293  bench: wall-clock FPS metric for WebGPU path
c64931c  bench: nosim URL param for isolating render vs sim cost
201d8f8  phase4: bind-group cache patch + WebGPU timestamp-query instrumentation
cb8e93a  fix(webgpu): timestampQuerySet misroute + staging-buffer lifecycle
1d25acc  bench: raw WebGPU comparison test page
9289c56  phase4: vertex-pulling for draw-points + draw-curve-line on WebGPU
01ff047  fix(webgpu): luma.gl bufferLayout stepMode silently dropped — 60x
46eaa59  feat(render): premultiplied alpha + fwidth analytic AA
925a8a0  fix(render): fwidth must be in uniform control flow (WGSL spec)
a33853e  feat: adaptive pixelRatio during pan/zoom/drag/sim
0801fd7  perf(forcelink): pack 3 link-attribute textures into 1 rgba32f
98b59a6  perf(forcelink): textureLoad for link-bundle reads; drop sampler
f204c12  docs: luma.gl 9.2.6 upstream issue drafts (4 bugs)
```

## Performance picture (Chrome 148, M5 Max, sim+render, DPR=2)

| n      | Before (1.5fps regime) | After  | Speedup |
|--------|------------------------|--------|---------|
| 10k    |  60 fps  (vsync cap)   |  60    |   1×    |
| 100k   |   1.5                  |  ~50   |  ~33×   |
| 250k   |   —                    |  22    |   —     |
| 500k   |   —                    |  ~10   |   —     |
| 1M     |   —                    |   3.2  |   —     |

Numbers from a cool Mac. After ~1 hour of sustained benchmarking the M5
Max thermal-throttles ~30-50%; if you're seeing lower numbers, restart
Chrome and let the GPU idle for a few minutes.

## Per-pass breakdown at n=100k (cold Mac)

| Pass                  | ms     |
|-----------------------|--------|
| force.link.outgoing   | ~25    |
| force.link.incoming   | ~25    |
| render.lines          | ~10    |
| render.points         | ~7     |
| force.repulsion       | ~1.5   |
| force.gravity         | <0.01  |

## Four luma.gl 9.2.6 bugs patched (filing-ready upstream — see [docs/luma-gl-upstream-issues.md](./luma-gl-upstream-issues.md))

1. **`bufferLayout[i].stepMode` silently dropped** — the 60× perf bug.
2. **`WebGPURenderPipeline` single-slot bind-group cache** — TODO in upstream.
3. **WGSL `var<storage>` bindings dropped from shader layout** — blocks
   vertex-pulling pattern.
4. **`props.timestampQuerySet` misrouted to `occlusionQuerySet`** — silent
   render-pass failure that masquerades as 60fps via empty-canvas rAF.

All four are patched via `patch-package` in `patches/`. They should be
filed at https://github.com/visgl/luma.gl/issues so the local patches can
be retired against an upstream release.

## Architectural changes applied

- **Vertex-pulling** for drawPoints and drawCurveLine: positions read from
  a storage buffer indexed by `instance_index` instead of
  `textureSampleLevel(positionsTexture, ...)`. The texture-sampling-in-vertex
  pattern is a slow path on Apple TBDR.
- **Premultiplied alpha** (`vec4(rgb * a, a)` + `srcFactor: 'one'`):
  composites correctly under stacked translucent points and engages a
  TBDR fast path that skips per-fragment srcAlpha multiplication.
- **`fwidth()`-based analytic AA** for points: the smoothstep range is
  always one device pixel regardless of zoom or size. Crisp at every scale.
- **Adaptive DPR**: drops `useDevicePixels` to 1.0 during pan/zoom/drag/sim;
  restores after the configured settle window. Pan on a 1M-node graph at
  full DPR is glacial; at adaptive DPR it's smooth.
- **Link-texture packing**: three link-attribute textures (indices,
  bias-strength, random-distance) collapsed into one rgba32f. Drops two
  sampler bindings and saves ~16 MB GPU memory across the two
  incoming/outgoing ForceLink instances.
- **`textureLoad` for link path**: skips sampler hardware on the inner
  loop's per-link fetches.
- **WebGPU `timestamp-query` instrumentation**: per-pass GPU timings now
  work on WebGPU, not just WebGL2. Same `TimerQueryPool` API.

## Things tried that didn't bank (reverted)

These were applied, measured, and rolled back when bench numbers didn't
support them or they introduced subtle bugs:

- Constant-hoisting in the force-spring inner loop (compiler already did
  better; got regressed timing).
- `transformationMatrix4x4` cache returning the same Float32Array (broke
  luma.gl's uniform diffing somehow — sim slowed dramatically).
- `ensureVec2/Vec4` returning input array as-is (caused incorrect values
  downstream).
- force-level `inverseSqrt` refactor (couldn't isolate the gain from
  thermal noise).
- `@builtin(position)` in fragment shader for `textureLoad` on
  linkInfoTexture (luma.gl's shader-layout reflection didn't recognize
  the multi-input fragment).

## Open / next-session work

In rough priority for further wins:

1. **Compute-shader port for force.link** — the dominant remaining cost
   at 100k+. Per agent research: 1-2 day project; expected ~40% drop
   on force.link, pushing 100k → 70+ fps and 250k → 30+ fps.

2. **MSAA 4× opt-in beauty mode** — needs to bypass luma.gl's render-pass
   wrapper (which doesn't expose `resolveTarget`) or patch luma.gl to
   support it. Quality feature, not perf.

3. **Render bundles for the canvas pass** — eliminates JS-side encoding
   overhead per frame. Helps CPU-bound systems more than GPU-bound; modest
   on M5 Max. ~2-3 hour project.

4. **Hierarchical LOD / supernodes** — the only thing that buys 10M+
   viability. 2-4 week project. Sigma.js v4 roadmap parallels this;
   deck.gl already ships `ClusterTileLayer`.

5. **Top-K links per tile** — caps density at zoomed-out views. ~1 day.

6. **File the 4 luma.gl bugs upstream** — copy from
   `docs/luma-gl-upstream-issues.md`. ~30 min.

## Reference points

- Raw WebGPU baseline (no luma.gl): 1.245 ms GPU pass at n=100k, 3.473 ms
  at n=1M. M5 Max can do 1M+ instanced quads at 60+fps natively. Live
  reproduction page: `benchmarks/raw-webgpu-100k.html`.
- WebGL2 reference (cosmos.gl baseline): ~13 fps at n=100k sim+render.
  kajillion WebGPU now ~4× faster than that.
- No other public WebGPU graph engine reports 100k+ alpha-blended
  billboards at 60fps on M-series specifically (GraphPU/GraphWaGu the
  only published peers; neither documents Apple Silicon numbers).
