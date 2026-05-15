# Kajillion benchmark harness

Deterministic baseline benchmark for the Kajillion rendering engine. Every
perf-bearing commit should be measured against the previous baseline using
this harness before claiming a speedup.

## Quick start

```bash
npm run bench:dev
```

Open <http://localhost:4173>. The page generates a Barabási–Albert graph,
loads it into the engine, runs a warmup window, then captures
`graph.getGpuTimings()` over the measurement window and renders a sorted
table of per-pass GPU time.

## Parameters (URL query)

| Param | Default | Meaning |
|---|---|---|
| `n` | 100000 | Node count |
| `m` | 3 | Edges per new node (BA model). Final edge count ≈ `n * m`. |
| `seed` | 42 | RNG seed for the BA generator and initial positions. |
| `warmup` | 2000 | Milliseconds to render before measurement starts. |
| `measure` | 8000 | Milliseconds of measurement window. |
| `data` | `ba` | Dataset generator: `ba` or `cosmo` for the cosmo-lab community graph. |
| `useWebGPU` | `false` | Use the WebGPU path when set to `1` or `true`. |
| `nosim` | `false` | Disable simulation so render cost can be isolated. |
| `continuousRender` | `false` | Keep rendering after settle; use with `nosim=1` for render-only GPU timings. |
| `renderLinks` | `true` | Set `0` or `false` for points-only render diagnostics. |
| `pointDefaultSize` | `2` | Override default point sprite size for render sweeps. |
| `linkDefaultWidth` | `0.5` | Override default link width for line fill-cost sweeps. |
| `pointMinPixelSize` | engine default | Override point sub-pixel culling threshold. |
| `linkMinPixelLength` | engine default | Override link sub-pixel culling threshold. |
| `pixelRatio` | device DPR | Override canvas pixel ratio. |
| `adaptiveDpr` | engine default | Set `1`/`true` or `0`/`false` to force adaptive DPR on/off. |
| `msaa` | `1` | Set `4` for WebGPU 4x MSAA canvas pass. |
| `frameRateLimit` / `fpsCap` | `0` | Pace the render loop to this FPS. `0` or omitted means native rAF cadence. |
| `frameRateHeadroomFps` / `fpsHeadroom` | `0` | Optional high-refresh soft cap: target detected display Hz minus this amount when `frameRateLimit=0`. |

Example: <http://localhost:4173/?n=250000&m=3&warmup=3000&measure=10000>

## What's measured

Per-pass GPU time via `EXT_disjoint_timer_query_webgl2`. Currently
instrumented:

- `force.gravity`, `force.center`, `force.repulsion`,
  `force.link.incoming`, `force.link.outgoing`, `force.cluster`,
  `force.mouse`
- `render.lines`, `render.points`

Each pass is timed with a `TIME_ELAPSED_EXT` query bracketing the
GPU work that advances that pass. Results are a rolling 60-sample
window; the harness reports the average and the most recent sample.

## Methodology notes

- **Browser support.** The harness requires `EXT_disjoint_timer_query_webgl2`,
  which is reliably available on Chromium-based browsers and Safari 16+.
  Firefox often disables it. If the timing table comes back empty, check
  `getGpuTimings()` returning `null`.
- **Determinism.** The BA generator and initial-position random walk are
  both seeded by the `seed` parameter. Force-simulation evolution is not
  perfectly deterministic across runs (FBO float ordering can vary), but
  steady-state per-pass timings should be stable within ~5% across runs.
- **What this does NOT measure.** Wall-clock frame time, CPU JS work,
  hover-pick readback stalls, or first-paint latency. Those need separate
  instrumentation; this harness is GPU-time only.
- **Warmup matters.** Force simulation cools down over thousands of ticks
  (`simulationDecay` default = 5000). Short warmups undercount steady-state
  cost while alpha is high.

## Interpreting results

The total of per-pass averages approximates per-frame GPU time. To check
against your 60 Hz budget (≈16.7 ms), sum the averages — if it's near or
over budget, the GPU is saturated and adding work will drop frames. The
biggest single number identifies the dominant bottleneck for the next
optimization to target.

## Reproducibility checklist

Before publishing a performance claim against the upstream cosmos.gl
baseline:

1. Run with identical `n`, `m`, `seed`, `warmup`, `measure`.
2. Run at least 3 times; report median.
3. Note device pixel ratio (`window.devicePixelRatio`) and viewport size —
   both affect fragment-shader cost.
4. Note GPU model (Apple M-series, Intel UHD, etc.) — variance across
   GPUs is far larger than variance across runs.
5. Confirm browser + version.
