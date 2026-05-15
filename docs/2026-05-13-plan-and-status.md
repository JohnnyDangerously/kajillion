# Kajillion — Plan, Status, Next

Snapshot taken 2026-05-13 after the WebGPU sim-sync fix landed.

## Project plan

Build a WebGPU-first graph visualization engine that beats the existing
WebGL2 leader (cosmos.gl, as deployed in cosmo-lab) on the same workloads,
on the same hardware, on the same data. Ship a credible headline demo at
n=1M nodes that no current OSS engine can match in a browser tab.

The work breaks into four arcs:

1. **Correctness.** WebGPU port renders what the simulation produces.
2. **Parity.** Match WebGL2 numbers at n≤100k.
3. **Win.** Beat WebGL2 numbers at the sizes anyone cares about (50k–500k).
4. **Headline.** Ship a 1M-node pre-baked demo as proof.

## Assumptions

- **Hardware target.** Apple M5 Max, 60 Hz internal display, Chrome/Dawn
  WebGPU on Metal. AC power, Low Power Mode disabled — all benches
  re-validate this via `pmset` + `navigator.getBattery` because LPM
  silently halves GPU throughput.
- **Browser target.** WebGPU-capable evergreen (Chrome 120+, Safari TP).
  No WebGL2 fallback shipping in kajillion — that's cosmos.gl's job.
- **Workload.** Force-directed layout over Barabási–Albert and
  cosmo-lab-style community graphs at n=5k…1M. Edges interleaved
  Float32; positions interleaved Float32; one render canvas per Graph.
- **Comparison baseline.** cosmo-lab on `cosmos.gl@3.0.0-beta.8` running
  inside `tokyo-graph-tools/ui-simple` at `localhost:5173/?lab=cosmo`,
  measured by `ui-simple/src/features/cosmo-lab/bench.sh`.
- **Fork posture.** Hard fork. Free to make breaking changes. `upstream`
  remote is fetch-only. No "could be PR'd back" framing.
- **Vsync cap.** 60 fps is the ceiling on the test display. Anything
  reporting 60.0 wall fps is vsync-bound, not GPU-bound — judge those
  runs by the GPU-timer ms-per-pass, not wall fps.
- **Bench validity rules.** Same DPR, same viewport, same generator,
  same seed, same power state. The bench JSON captures all of these so
  cross-run comparisons can be rejected when any drift.

## What's done

### Foundation
- Forked cosmos.gl → kajillion. Rename, license, README, package
  scope (`@kajillion/graph`). Public repo.
- `EXT_disjoint_timer_query` instrumentation on the WebGL2 path; WebGPU
  timestamp-query instrumentation on the WebGPU path. Both feed the
  same `GpuTimingSnapshot` shape.
- Bench harness at `benchmarks/` with URL-param control (`n`, `seed`,
  `data`, `pixelRatio`, `msaa`, `useWebGPU`, `nosim`, `repeat`, …),
  power-state capture, throttle warning, JSON post to vite middleware
  that writes `benchmarks/results/*.json`.
- Cosmo-lab graph generator ported to `benchmarks/src/generate-cosmo.ts`
  for apples-to-apples comparison.

### Phase 1 — WebGL2 polish (shipped)
- Stale-force-pass skip when alpha is low.
- Fixed-step physics + render interpolation.
- Lower `simulationDecay` default, add `alphaStopThreshold` knob.
- Coarse tile frustum culling for points + links.
- Time-based alpha decay (decouples settle time from FPS).

### Phase 3.3 — WebGPU end-to-end render (shipped)
- WebGPU device path through luma.gl 9.x.
- `gl_PointSize` + line-width emulation in WGSL.
- Idle-frame skip (41 → 60 fps when fully settled).
- Render bundles for the canvas pass.
- MSAA 4× via hand-rolled descriptor.
- Per-instance compute pre-passes for points and lines (vertex pulling
  from storage buffers).
- Settle-tail force throttle.
- Dynamic loop bounds + adaptive theta.
- Workgroup-size tuning (8,8,1 → 8,4,1).
- Cooperative force kernel.

### Phase 4 — Compute force-pass port (shipped)
- Barnes-Hut quadtree build + traversal in WGSL.
- Compute force.repulsion / link.incoming / link.outgoing.
- `quadtree.build` instrumented separately so it doesn't hide inside
  `force.repulsion`.

### Demo site (shipped, except headline asset)
- `demo/` folder, vite config, deploy.
- Hero 100k graph + perf overlay.
- Sidebar controls (n, MSAA, adaptive DPR, blend, sim toggle).
- Baseline snapshot recorder.
- `/bake` endpoint + Vite plugin to save binary positions.
- "Bake current layout" sidebar button.
- "Load baked layout" mode (sim disabled, second canvas).
- **Still pending:** actually generate and ship the 1M-node asset.

### Today's headline fix (2026-05-13)
- **Root cause found.** `syncPositionStorageBuffer` called
  `commandEncoder.copyTextureToBuffer` with `bytesPerRow = size*16`,
  violating WebGPU's 256-byte row-alignment requirement. WebGPU
  silently rejected the copy. The vertex shader read positions from a
  storage buffer that never updated — every WebGPU "sim" benchmark for
  weeks was measuring the cost of redrawing a frozen scatter cloud
  while the simulation cheerfully moved a texture nobody sampled.
- **Fix.** Replace `copyTextureToBuffer` with a one-thread-per-point
  compute pass (`sync-position-storage.compute.wgsl.ts`). No alignment
  requirement, ~0.1 ms at n=1M.
- **Verification.** Pre-sim readback returns real seeded positions
  (`266.93, 300.65, …`), post-1.5s-sim readback returns moved
  positions (`291.51, 283.18, …`). Sim now visibly converges in the
  bench page.
- **Result.** Real numbers on cosmo-lab community data:

  | n     | wall fps           | force.repulsion | render.canvas |
  |-------|--------------------|-----------------|---------------|
  | 50k   | 60.0 (vsync cap)   | 2.38 ms         | 3.18 ms       |
  | 100k  | 60.0 (vsync cap)   | 3.03 ms         | 5.32 ms       |
  | 250k  | 47.8               | 7.92 ms         | 20.76 ms      |
  | 500k  | 36.6               | 12.18 ms        | 56.52 ms      |

- **Head-to-head at n=50k.** cosmo-lab (cosmos.gl beta.8) = 51 fps.
  Kajillion WebGPU = 60 fps. **Kajillion genuinely beats cosmos.gl now**,
  on the same data, the same machine, the same browser tab.

## What's next

Ranked by leverage. Each item has a "why now" hook so the order can be
re-shuffled when priorities shift.

### 1. render.canvas scaling investigation
**Why now.** It's the dominant cost above n=100k and grows super-linearly
(20.76 → 56.52 ms from 250k → 500k). Every other optimization gets
hidden behind it. Plausible wins:
- DPR=1 vs DPR=2 measurement. On Retina the fragment shader runs over
  ~4× as many pixels at DPR=2. If the gap is huge, adaptive DPR or
  DPR=1 default becomes the cheap headline win.
- Line shader fragment cost. Lines dominate render.canvas at high n —
  most of the painted pixels are anti-aliased edges. Audit the AA term
  for early-out opportunities.
- MSAA cost vs FXAA-style post pass at n≥250k.
- Discard tile-binned points/lines whose bounding box is sub-pixel.

### 2. Ship the 1M-node baked headline
**Why now.** All the plumbing (#60, #61, #62) is in. The sim is
correct as of today. A real settled 1M layout, loaded from a binary
asset with sim disabled, would be the demo screenshot/video that
sells the engine. The bake produces a Float32Array of positions;
load-time path skips the simulation entirely.

Risks:
- File size at n=1M is 8 MB of Float32 positions — fine for a demo
  asset, gated behind a click in the sidebar.
- Settling 1M nodes from scratch may take 30–60 s of sim time. One
  long-running tab session; not bench-style.
- Need to confirm visual quality of the resulting layout before
  committing — settled does not mean pretty.

### 3. Lock in the head-to-head win with a writeup
**Why now.** "Beat the leader on the same machine on the same data"
is the single most credible claim kajillion has. Right now it lives
in commit messages and a bench results folder. Worth pulling forward
into the README before the next round of changes muddies the numbers.

Contents would be:
- Methodology (data generator, seed, hardware, browser, power state).
- Reproducer commands.
- The 50k table above + a chart up to 500k.
- The vsync-cap caveat called out so 60 vs 51 isn't misread as the
  full margin.

### 4. WebGPU async readback for `getPointPositions()` (#58 is done; consumer-facing API)
**Why now.** The sync-position compute pass now gives us a fast,
correct path from GPU positions to a host-readable buffer. Exposing
that as a public `await graph.getPointPositions()` makes kajillion
embeddable inside React apps that want to drive labels, click
targets, or off-thread bookkeeping. The bake demo is already using
the same machinery internally.

### 5. Lower-priority polish backlog
- Bench: DPR sweep + msaa=1/4 sweep, dump a single table.
- Bench: optional CI mode that fails on >10% regression vs latest.json.
- Demo: settle-quality knob (lower friction late in settle for
  prettier asymmetric layouts).

### Visual exploration memory
- **Hive plots / layered axis plots.** Keep this as an exploratory visual
  direction, not a committed product mode. The appeal is a hybrid between
  graph and aggregate multi-edge system: nodes arranged on explicit axes or
  layers, with many relationships visible as a combined flow/structure rather
  than a full force-directed hairball. This may pair well with Kajillion's
  soft-lane / edge-conflation ideas because it can show the combined effect
  of many edges without drifting all the way into organic vein-like bundling.
  Candidate use: alternate overview mode for layered, typed, or temporal
  relationships where a normal galaxy graph is beautiful but too ambiguous.
- **Sticky zoom / reveal levels.** Future usability mode inspired by
  Cosmograph-style "sprawl-out" navigation: wheel/trackpad zoom snaps through
  semantic levels instead of continuously scaling forever. Example sequence:
  focused person -> immediate network -> communities -> whole graph. Each
  step can reveal more nodes/edges and repack labels, so the user feels the
  graph unfolding rather than just getting smaller. This is not an engine
  priority until replay/perf capture is in place, because the effect must be
  measured for pacing and perceptual stability.
- **Motion personality.** Explore a small amount of tasteful physical motion:
  slight expansion/sprawl during first reveal, damped settling after focus,
  and sticky camera easing. Keep it interaction-driven and deterministic for
  demos; avoid returning to arbitrary live-force jitter once the graph is
  presented as settled.
- **Perceptual scheduling roadmap.** See
  [2026-05-14-perceptual-scheduling-roadmap.md](./research/2026-05-14-perceptual-scheduling-roadmap.md).
  North star: show the whole graph immediately as an impression, then
  crystallize detail where attention lands. Use density before nodes, bundles
  before individual edges, clusters before labels, halos before geometry, and
  motion/attention-gated LOD swaps. The immediate technical hook is visual
  mass conservation: when exact nodes or edges appear, the aggregate density
  or bundle layer should dim by a matching perceived luminance so the scene
  feels like it sharpened rather than popped.
- **Selectable foreground vs visual mass.** Keep the product option open for
  a three-layer graph where distant/background dots are non-selectable visual
  mass, while promoted high-connectors, average connectors, and second-degree
  connectors become selectable as the user zooms or follows connection
  strength. This would let Kajillion show a graph that feels much larger than
  the active interaction set, then progressively promote nodes into full
  equal-size objects at the appropriate semantic zoom level.

## Open questions / risks

- **Apple-only validation.** All numbers are M5 Max. Need at least one
  Linux NVIDIA + one Windows AMD data point before claiming
  cross-platform parity. Don't ship the headline claim without this.
- **luma.gl coupling.** The bind-group cache fix is a local patch. If
  luma.gl 9.x ships a breaking change, the WebGPU path takes work to
  re-land. Watch upstream releases; consider vendoring the affected
  modules if churn continues.
- **cosmos.gl moving target.** cosmo-lab tracks beta.8. If they ship a
  WebGPU path, the head-to-head story has to be re-measured fast.
- **1M demo perceived value.** Pretty layouts at n=1M are rare in
  practice; most real graphs that big are partitioned or sampled
  before render. The demo sells capability, not workflow — make sure
  the surrounding copy reflects that.
