# Kajillion

**A kajillion nodes. In your browser. Without lag.**

Kajillion is an extreme-scale GPU graph renderer, forked from [cosmos.gl](https://github.com/cosmosgl/graph) and re-engineered for absurd node counts and zero perceived latency. Pan, zoom, click, hover — instant at every scale, from a hundred nodes to a billion.

> Pre-alpha. The current build is baseline-identical to cosmos.gl `a6073ea`; performance work is landing in phases (see [Roadmap](#roadmap)). For production use today, prefer upstream cosmos.gl.

---

## Why a fork?

cosmos.gl is excellent — the GPU pyramid force compute is clever and the API is clean. But there are known bottlenecks at deep zoom, galaxy zoom, and high node counts: no frustum culling, full pyramid rebuild every tick regardless of motion, no atlas mipmaps, synchronous hover readback, single-threaded run loop. Kajillion exists to fix those without compromising visual fidelity.

The downstream API stays compatible where it can; new features hide behind feature flags.

---

## Roadmap

### Phase 0 — Baseline & instrumentation
- [x] Fork cosmos.gl `a6073ea`
- [ ] `EXT_disjoint_timer_query` per-pass instrumentation
- [ ] Benchmark harness with representative dataset
- [ ] Live perf overlay

### Phase 1 — Smoothness
- [ ] Fixed-step physics + render interpolation
- [ ] Coarse tile frustum culling (points & links)
- [ ] Stale-pyramid reuse
- [ ] Async picking via `fenceSync`
- [ ] Tuned alpha decay defaults + early-stop knob

### Phase 2 — Zoom fidelity
- [ ] `TEXTURE_2D_ARRAY` atlas + per-slice mipmaps + dominant-color impostor
- [ ] Density-field edge rendering at galaxy zoom
- [ ] Morton-sorted node buffer
- [ ] Per-component visibility thresholds
- [ ] Adaptive quality via timer queries

### Phase 3 — Force-compute redesign
- [ ] Mipmap-pyramid (rapid-multipole) repulsion
- [ ] MRT-fused force passes
- [ ] Stale cluster-force reuse
- [ ] WebGPU compute path (spike)

### Phase 4+ — Billion-node tier
- [ ] Tile pyramid LOD + viewport-attention rendering
- [ ] Offline batched layout pipeline
- [ ] OffscreenCanvas + worker

---

## Quick Start

> Pre-release. API mirrors cosmos.gl `v3.0.0-beta.8`.

```bash
npm install @kajillion/graph
```

```ts
import { Graph } from '@kajillion/graph'

const div = document.querySelector('div')
const graph = new Graph(div, {
  spaceSize: 4096,
  simulationFriction: 0.1,
  simulationGravity: 0,
  simulationRepulsion: 0.5,
  curvedLinks: true,
  fitViewOnInit: true,
})

graph.setPointPositions(new Float32Array([0,0, 1,0, 0.5,1]))
graph.setLinks(new Float32Array([0,1, 1,2, 2,0]))
graph.render()
```

For full API documentation while Kajillion-specific docs are being written, see the [upstream cosmos.gl reference](https://cosmosgl.github.io/graph/).

---

## Attribution

Kajillion stands on the work of the cosmos.gl team — **Nikita Rokotyan, Olga Stukova, Denis Ovsyannikov** and contributors. The original engine, GPU pyramid force compute, luma.gl-based rendering pipeline, and large parts of this codebase remain theirs. Kajillion's contribution is the performance-engineering layer on top.

If you use Kajillion in academic work, please cite both projects — see [CITATION.cff](./CITATION.cff).

---

## License

MIT. See [LICENCE](./LICENCE) — original cosmos.gl copyright preserved; Kajillion-Contributors copyright added for fork modifications.

---

## Status

Pre-alpha. Not yet recommended for production. Track progress on the roadmap above.
