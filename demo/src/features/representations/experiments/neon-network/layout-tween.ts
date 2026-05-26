import type { Graph } from '@kajillion/graph'

// Reusable scratch buffers — sized lazily so we never hold more memory than
// the largest tween needs, but also never realloc on identical-shape tweens.
let posScratch: Float32Array | null = null
let sizeScratch: Float32Array | null = null
let fromPosSnapshot: Float32Array | null = null
let fromSizeSnapshot: Float32Array | null = null

function ensureScratch (n: number): { pos: Float32Array; size: Float32Array; fromPos: Float32Array; fromSize: Float32Array } {
  if (!posScratch || posScratch.length < n) posScratch = new Float32Array(n)
  if (!fromPosSnapshot || fromPosSnapshot.length < n) fromPosSnapshot = new Float32Array(n)
  // sizes are 1 float per node = half the length of positions
  const sn = n >> 1
  if (!sizeScratch || sizeScratch.length < sn) sizeScratch = new Float32Array(sn)
  if (!fromSizeSnapshot || fromSizeSnapshot.length < sn) fromSizeSnapshot = new Float32Array(sn)
  return { pos: posScratch, size: sizeScratch, fromPos: fromPosSnapshot, fromSize: fromSizeSnapshot }
}

/**
 * Animate positions + sizes from the engine's currently-displayed state
 * to `(toPos, toSize)` over `durationMs`. Reads `graph.getPointPositions()`
 * + `graph.getPointSizes()` at tween start, so interrupting a prior
 * tween picks up from the visible state rather than snapping to the
 * old target first.
 *
 * `ease`:
 *   - `'cosine'` (default): smooth in-and-out — best for layout swaps.
 *   - `'burst'`: ease-out-cubic — front-loaded motion, the cluster
 *     "booms" into place. Use when the transition is a deliberate UX
 *     moment (e.g. explode).
 */
export function tweenPositionsAndSizes (
  graph: Graph,
  toPos: Float32Array,
  toSize: Float32Array,
  durationMs: number,
  ease: 'cosine' | 'burst' = 'cosine'
): () => void {
  // getPointPositions returns number[], getPointSizes returns Float32Array.
  // Normalise both into our typed-array scratch.
  const livePos = graph.getPointPositions()
  const liveSize = graph.getPointSizes()
  if (livePos.length !== toPos.length || liveSize.length !== toSize.length) {
    graph.setPointPositions(toPos, true)
    graph.setPointSizes(toSize)
    graph.render()
    return () => undefined
  }
  const { pos: posS, size: sizeS, fromPos, fromSize } = ensureScratch(toPos.length)
  for (let i = 0; i < toPos.length; i += 1) fromPos[i] = livePos[i] as number
  fromSize.set(liveSize.subarray(0, toSize.length))
  const start = performance.now()
  let cancelled = false
  let rafId = 0

  const easeFn = ease === 'burst'
    ? (t: number): number => 1 - Math.pow(1 - t, 3) // ease-out cubic
    : (t: number): number => 0.5 - (Math.cos(Math.PI * t) * 0.5) // cosine

  const step = (now: number): void => {
    if (cancelled) return
    const t = Math.min(1, (now - start) / durationMs)
    const e = easeFn(t)
    if (t === 1) {
      graph.setPointPositions(toPos, true)
      graph.setPointSizes(toSize)
    } else {
      for (let i = 0; i < toPos.length; i += 1) {
        const a = fromPos[i] as number
        const b = toPos[i] as number
        posS[i] = a + ((b - a) * e)
      }
      for (let i = 0; i < toSize.length; i += 1) {
        const a = fromSize[i] as number
        const b = toSize[i] as number
        sizeS[i] = a + ((b - a) * e)
      }
      graph.setPointPositions(posS.subarray(0, toPos.length), true)
      graph.setPointSizes(sizeS.subarray(0, toSize.length))
    }
    graph.render()
    if (t < 1) rafId = requestAnimationFrame(step)
  }
  rafId = requestAnimationFrame(step)

  return () => {
    cancelled = true
    if (rafId !== 0) cancelAnimationFrame(rafId)
  }
}
