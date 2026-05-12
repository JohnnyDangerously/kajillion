# 2026-05-12 Session 3 — Autonomous perf-grind log

User was away for several hours. Mandate: test all four ranked
optimizations from the prior scaling audit, dispatch a thorough
perf-hunting subagent after each, and report back with what shipped vs
reverted.

## TL;DR for return

**Two new wins shipped, validated on cool AC 100% with 5-repeat
medians.** Two hypotheses tested negative, one untestable due to
mid-session power-state change.

| Commit | Change | Wall-clock impact |
|---|---|---|
| `f7a0979` | **Idle-frame skip when settled** | Post-settle **41.4 → 60.0 fps** (vsync) |
| `cd9d59d` | **Settle-tail force throttle** (alpha < 0.3 → every other frame) | Active-sim **41.4 → 53.6 fps** (+29%) |

Both validated under the same cool-GPU AC-100% protocol that retroactively
exposed a prior session's "31% line-precompute win" as a thermal artifact.

## Phase results in detail

### Phase 1 (shipped: `cd9d59d`) — settle-tail force throttle
At `store.alpha < 0.3`, run force passes every other frame in
`runSimulationStep`. Newtonian inertia from stale velocity coasts
positions on skipped frames; visible motion at low alpha is sub-pixel.
The threshold preserves full-rate motion during the first ~70% of the
"spring + settle" arc.

### Phase 2 (tested-negative, reverted) — adaptive theta + dynamic bounds
Tried four variants over ~45 min. All either no-op or regression:
1. `simulationRepulsionTheta: 1.15 → 1.5` default — **0 change**. The
   WGSL inner loops iterate `0..12 × 0..4` unconditionally; theta only
   affects the per-iter if-check. Loops are the cost, not textureLoads.
2. Cap `iiMax/jjMax` to `min(12, levelTexSize)` per level — **-3 fps**
   regression. Low levels dominate of the savings, but their work is
   small to begin with; the high-level iterations (which dominate cost)
   were unaffected.
3. Audit-recommended `rsqrt` swap + `f32`→`u32` loop counters — **0 ms
   change**. Apple Metal's compiler already fuses these.
4. Defer `syncPositionStorageBuffer` to sim-tick frames only — **-5 fps**.
   Likely pipeline-ordering side effect from skipping the encoder copy.

### Phase 3 (unvalidated — re-test on AC) — workgroup_size (8,8,1)→(8,4,1)
Apple GPU subgroup is 32 threads; (8,4) = 32 = exactly 1 subgroup,
whereas (8,8) = 64 = 2 subgroups. Implementation works (canvas renders
correctly), but **power dropped to Battery 99% LPM=1 mid-test**, which
invalidates all numbers per the now-saved `feedback_bench_check_power_state`
memory rule. Reverted to keep HEAD honest. **2-character change to
retry on AC:**

```diff
--- src/modules/ForceManyBody/force-many-body.compute.wgsl.ts
-@compute @workgroup_size(8, 8, 1)
+@compute @workgroup_size(8, 4, 1)

--- src/modules/ForceManyBody/index.ts
-const groups = Math.ceil(size / 8)
-pass.dispatch(groups, groups, 1)
+const groupsX = Math.ceil(size / 8)
+const groupsY = Math.ceil(size / 4)
+pass.dispatch(groupsX, groupsY, 1)
```

### Phase 4 (deferred) — workgroup-cooperative force kernel
12–20 hours estimated effort per scaling agent. Without battery-state
ability to bench, can't validate. Documented for future.

## Audit findings (4 subagents dispatched, audits ~600-1200 words each)

### Audit #1 — micro-opts in hot-path WGSL/JS
10 findings. Top 4 tested mechanically — **all 0 ms impact.** Lesson:
Apple Metal compiler micro-fuses better than expected. Stop ranking
ALU-savings findings as "high impact."

### Audit #2 — wider scope orchestration
Claimed `drawLevels` zeroes 256MB texture every frame ("2-4 ms win").
**Audit #3 verified this claim is FALSE** — `copyImageData` is
init-only.

### Audit #3 — verify #2's claim + true frame breakdown
**KEY FINDING:** `drawLevels` runs every frame as **14 render passes**
(point-list rasterization with additive blend, 100k vertices per pass),
but is **NOT a named timer-pool entry** — its cost hides inside the
`force.repulsion` bracket. The "force.repulsion: 5 ms" actually
includes both:
- 14 quadtree-build passes (calculate-level fragment shader)
- 1 force-sampling compute dispatch (force-many-body compute)

**To split the cost**, wrap drawLevels with its own timer:
```ts
// in ForceManyBody.run() (or src/index.ts before forceManyBody.run())
this.timerQueryPool?.begin('force.quadtree.build')
this.drawLevels()
this.timerQueryPool?.end()
```

Also surfaced: deepest level texture is **4 GB** (16384×16384 rgba32f at
spaceSize=16384), not 256 MB. Not used per frame but huge memory
footprint at init.

### Audit #4 — strategic roadmap to 1M nodes
**The audit's headline finding: stop chasing 41 → 60 fps at n=100k
sim-active. That number is a developer trophy that visitors don't see.
The website ships on three demo-experience wins (all hours of work, not
days):**

1. **`simulationDecay: 1000 → 400-500`** in `src/variables.ts:63`. At
   default, alpha falls from 1.0 to 0.05 in ~7s. Visitors stare at a
   writhing mass that long before it "becomes a graph." Drop to 500 and
   it settles in ~3.5s. Cheap config change.
2. **`adaptivePixelRatio: true` default**. Pan/zoom drops DPR to 1.0
   during interaction → snaps back on settle. Currently OFF by default.
   Turns "this lags when I scroll" into "this feels native."
3. **`linkBlendMode: 'add'` default**. Dense graphs "glow"; zero perf
   cost (same code path).

**The real headline demo, however**: a **pre-baked 1M-node layout**
shipped as a static asset, with `enableSimulation: false`. Render-only at
1M with adaptive DPR sits in the 20-30 fps band — visitors don't need
to watch sim, they need to be shown a 1M-node network they can pan.

Audit also fact-checks audit #2's hidden findings:
- **force.repulsion at n=100k IS bandwidth-bound** (14 levels × ~48
  texture samples × N texels) — compiler already collapsed arithmetic
- **No supernode / LOD / tile code exists** anywhere in the tree — this
  is the unbuilt scaling path
- **WebGPU hard ceiling**: Apple Chrome default storage-buffer max is
  128 MB. Position buffer (16 B × N) is fine to 8M points; LineInstance
  pre-pass struct (80 B × 3N) would blow at ~530k nodes. Streaming needed
  above that. Quadtree-level textures (256 MB at 4096²) limit spaceSize.

**Caveat**: Audit #4 recommended "finish the scaffolded line precompute"
as item #1 — but it was based on session-2's log. In session 3 we
DID integrate that (commit 7953cc4) and DID HONEST A/B that showed it
was a **-5% wall-clock regression**, hence reverted (929d736). The
audit's prior is stale; the line precompute hypothesis is closed.

## State at handoff

- Working tree: **clean** at `cd9d59d`.
- All shipped commits validated on cool AC 100% with 5-repeat medians.
- 1 pending task: re-bench HEAD on AC to verify wall-clock didn't drift
  during testing; instrument drawLevels separately.

## Recommended next actions on user return

**The big strategic reframe (Audit #4):** website demo doesn't need
sim-active 60 fps. It needs (a) fast settle, (b) smooth pan/zoom, and
(c) an impressive scale story (pre-baked 1M).

### Tier 1 — DEMO-EXPERIENCE (hours of work, big visitor impact)
1. **Lower `simulationDecay` default** 1000 → 500 in `src/variables.ts:63`.
   Settle time halves from ~7s to ~3.5s. Visitors stop staring at a
   writhing mass.
2. **Flip `adaptivePixelRatio` default to true**. Pan/zoom feels native.
3. **Flip `linkBlendMode` default to `'add'`**. Dense graphs glow.
4. **Bake a 1M-node settled layout** as a static asset, demo with
   `enableSimulation: false`. The headline screenshot the engine has
   earned.

### Tier 2 — DIAGNOSTIC (after AC re-bench)
5. Plug in (AC) and wait 5 min for GPU cool-down.
6. Re-bench HEAD at n=100k 5-repeat — confirm 41.4 fps wall + 60 fps
   post-settle.
7. **Add `force.quadtree.build` timer wrap** to split the hidden 14
   render passes out of `force.repulsion`. This is the single most
   informative diagnostic — tells us whether further compute work on
   force-many-body matters at all.
8. If quadtree-build > 2 ms: try level-merging (combine smallest 2-3
   levels into one pass).
9. Re-test Phase 3 (workgroup_size 8,4,1) — 2-character diff documented
   in this log.

### Tier 3 — DEFERRED LONG TERM
- Phase 4 cooperative force kernel (12-20 hrs)
- Hierarchical LOD / supernodes — the real 1M-node-interactive path
  (months of work)
- Bench harness improvements (`mode=render-only|sim-only|settle-time`)
