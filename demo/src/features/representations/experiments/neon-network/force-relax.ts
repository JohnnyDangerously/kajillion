import type { Graph } from '@kajillion/graph'

/**
 * Short, damped edge-attraction pass that runs after the explode view's
 * burst tween settles AND real CSR edges arrive. The intent is to nudge
 * the rigid hub-and-spoke layout into something more organic — members
 * with cross-sub-cluster ties drift toward their connections, so the
 * visual reads as "people who really know each other end up near each
 * other" rather than "people who happen to share a facet value".
 *
 * Anchored points (`anchored` mask) don't move — used for the root and
 * the per-sub-cluster hub centroids so the macro layout stays put while
 * members relax around them.
 *
 * NO repulsion. All-pairs repulsion is O(N²); skipping it for now keeps
 * the relaxation cheap on big clusters. The initial spiral layout
 * already avoids overlaps; attraction pulls toward connections without
 * letting things collapse onto each other (much).
 */

export interface ForceRelaxOptions {
  /** Flat [src, dst, src, dst, …] index pairs — the same Float32Array
   *  Cosmos's setLinks expects, but we only read it here. */
  edges: Float32Array;
  /** Per-node mask: 1 = anchored (no force applied), 0 = free. The
   *  Uint8Array is read each frame so callers can flip bits to anchor
   *  / un-anchor on the fly (used for drag handling). */
  anchored: Uint8Array;
  /** How long to run before stopping (ms). Force is damped to zero by
   *  this point so the system "cools" rather than stops abruptly.
   *  Pass `Infinity` for an indefinite simulation that doesn't damp —
   *  use that for the portrait view where the user expects ongoing
   *  d3-style wiggle. */
  durationMs: number;
  /** Initial attraction strength. Tuned for our 8192-unit world space. */
  strength?: number;
  /** Target edge length in world units. Members of the same sub-cluster
   *  sit on ~700-unit orbits today; 250 pulls them noticeably closer
   *  without collapsing them onto the hub. */
  restLength?: number;
  /** Optional callback to source positions from somewhere other than
   *  `graph.getPointPositions()` each frame. Used during drag so the
   *  simulator reads the post-drag overrides rather than its own
   *  stale internal buffer. */
  readPositions?: () => ArrayLike<number>;
}

const DEFAULT_STRENGTH = 0.008
const DEFAULT_REST_LENGTH = 250

/**
 * Kick off the relaxation. Reads positions from the engine each frame
 * (so multi-source RAFs — rings, tweens — that finished before this
 * one don't fight us), applies a damped attraction step, writes back.
 * Returns a cancel handle.
 */
export function runForceRelaxation (
  graph: Graph,
  opts: ForceRelaxOptions,
): () => void {
  const edges = opts.edges
  const anchored = opts.anchored
  const durationMs = opts.durationMs
  const strength = opts.strength ?? DEFAULT_STRENGTH
  const restLength = opts.restLength ?? DEFAULT_REST_LENGTH

  const initial = opts.readPositions ? opts.readPositions() : graph.getPointPositions()
  const n = anchored.length
  if (n === 0 || initial.length / 2 !== n) return () => undefined
  // Mutable working buffer; we'll write back to the engine each frame.
  const pos = new Float32Array(initial.length)
  for (let i = 0; i < initial.length; i += 1) pos[i] = initial[i] as number

  const indefinite = !Number.isFinite(durationMs)
  const start = performance.now()
  let cancelled = false
  let rafId = 0

  const step = (now: number): void => {
    if (cancelled) return
    let stepStrength = strength
    if (!indefinite) {
      const t = Math.min(1, (now - start) / durationMs)
      // Damp from `strength` down to 0 over the run, cosine-eased so the
      // last steps barely move anything and the system settles cleanly.
      const damp = 0.5 + (Math.cos(Math.PI * t) * 0.5)
      stepStrength = strength * damp
      if (t >= 1) { rafId = 0; return }
    }
    // Pull externally-overridden positions in each frame (drag) before
    // computing forces, so the simulator never fights the cursor.
    if (opts.readPositions) {
      const live = opts.readPositions()
      for (let i = 0; i < pos.length; i += 1) {
        const v = live[i]
        if (v !== undefined) pos[i] = v as number
      }
    }

    // Walk each edge: pull endpoints toward each other proportional to
    // (dist - restLength). Sign means we PULL on long edges and gently
    // PUSH on short ones, but only as a side effect of the spring math.
    const edgeCount = edges.length / 2
    for (let e = 0; e < edgeCount; e += 1) {
      const a = edges[e * 2] as number
      const b = edges[(e * 2) + 1] as number
      const ax = pos[a * 2] as number
      const ay = pos[(a * 2) + 1] as number
      const bx = pos[b * 2] as number
      const by = pos[(b * 2) + 1] as number
      const dx = bx - ax
      const dy = by - ay
      const distSq = (dx * dx) + (dy * dy)
      if (distSq < 1) continue
      const dist = Math.sqrt(distSq)
      const f = (stepStrength * (dist - restLength)) / dist
      const fx = f * dx
      const fy = f * dy
      if (!anchored[a]) {
        pos[a * 2] = ax + fx
        pos[(a * 2) + 1] = ay + fy
      }
      if (!anchored[b]) {
        pos[b * 2] = bx - fx
        pos[(b * 2) + 1] = by - fy
      }
    }

    graph.setPointPositions(pos, true)
    graph.render()
    rafId = requestAnimationFrame(step)
  }
  rafId = requestAnimationFrame(step)

  return () => {
    cancelled = true
    if (rafId !== 0) cancelAnimationFrame(rafId)
  }
}
