import type { Graph } from '@kajillion/graph'
import { DEMO_SPACE_SIZE } from '../../../demo-lifecycle/demo-space'
import {
  applyVariantFrame,
  prepareVariant,
  resolveBloomVariant,
  type BloomState,
  type BloomVariant,
} from './bloom-variants'

const CX = DEMO_SPACE_SIZE / 2
const CY = DEMO_SPACE_SIZE / 2
const INNER_HOLE = DEMO_SPACE_SIZE * 0.016
const OUTER = DEMO_SPACE_SIZE * 0.49

interface BloomOptions {
  durationMs?: number;
  variant?: BloomVariant;
}

export { resolveBloomVariant }
export type { BloomVariant }

/**
 * Run a bloom animation. The variant chooses the per-node stagger pattern
 * and per-frame position/size updates; everything else (geometry pre-pass,
 * RAF loop, GPU upload) is shared. Variants live in bloom-variants.ts.
 *
 * Performance: 4000 nodes × ~90 frames at 60 FPS = trivial CPU; GPU sees
 * one setPointPositions + setPointSizes + render per frame.
 */
export function runBloomAnimation (
  graph: Graph,
  finalPositions: Float32Array,
  finalSizes: Float32Array,
  options: BloomOptions = {}
): () => void {
  const duration = options.durationMs ?? 1500
  const variant = options.variant ?? 'pop'
  const n = finalPositions.length / 2

  // Per-node geometry — same across all variants.
  const cosA = new Float32Array(n)
  const sinA = new Float32Array(n)
  const finalRadius = new Float32Array(n)
  for (let i = 0; i < n; i += 1) {
    const dx = finalPositions[i * 2] - CX
    const dy = finalPositions[i * 2 + 1] - CY
    const r = Math.sqrt(dx * dx + dy * dy)
    const inv = r > 1e-4 ? 1 / r : 0
    cosA[i] = dx * inv
    sinA[i] = dy * inv
    finalRadius[i] = r
  }

  const ringCount = Math.max(6, Math.min(80, Math.round(Math.sqrt(n / Math.PI) * 0.85)))
  const ringStep = (OUTER - INNER_HOLE) / ringCount

  const state: BloomState = {
    n,
    cx: CX,
    cy: CY,
    innerHole: INNER_HOLE,
    ringCount,
    ringStep,
    cosA,
    sinA,
    finalRadius,
    finalPositions,
    finalSizes,
    positions: new Float32Array(finalPositions.length),
    sizes: new Float32Array(n),
    startT: new Float32Array(n),
    scratch: { min: 0, max: 0 },
  }
  prepareVariant(state, variant)

  // Frame 0 — every variant starts with whatever its t=0 state is.
  applyVariantFrame(state, variant, 0)
  graph.setPointPositions(state.positions, true)
  graph.setPointSizes(state.sizes)
  graph.render()

  let cancelled = false
  let raf = 0
  const start = performance.now()

  const step = (): void => {
    if (cancelled) return
    const t = Math.min(1, (performance.now() - start) / duration)
    if (t >= 1) {
      graph.setPointPositions(finalPositions, true)
      graph.setPointSizes(finalSizes)
      graph.render()
      return
    }
    applyVariantFrame(state, variant, t)
    graph.setPointPositions(state.positions, true)
    graph.setPointSizes(state.sizes)
    graph.render()
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)

  return () => {
    cancelled = true
    cancelAnimationFrame(raf)
  }
}
