import { DEMO_SPACE_SIZE } from '../../../demo-lifecycle/demo-space'

const TAU = Math.PI * 2

/**
 * Concentric-ring layout: place every node on one of N rings around a
 * small black core. Ring count is chosen so dot spacing within a ring is
 * comparable to ring spacing, producing visible black gaps between rings
 * (the look of the reference artwork).
 */
export function concentricRingPositions (nodeCount: number, seed = 1): Float32Array {
  const positions = new Float32Array(nodeCount * 2)
  if (nodeCount <= 0) return positions

  const cx = DEMO_SPACE_SIZE / 2
  const cy = DEMO_SPACE_SIZE / 2
  const outer = DEMO_SPACE_SIZE * 0.49
  const innerHole = DEMO_SPACE_SIZE * 0.016

  // Target ring count: √(n / π) gives a near-square polar lattice. We scale
  // by 0.85 to widen each cell slightly so 6-7 px dots leave a visible black
  // gap between neighbours (the "border" effect of the reference).
  const ringCount = Math.max(6, Math.min(80, Math.round(Math.sqrt(nodeCount / Math.PI) * 0.85)))
  const ringStep = (outer - innerHole) / ringCount

  // Distribute proportionally to circumference (i.e. radius).
  const ringWeights = new Float32Array(ringCount)
  let totalWeight = 0
  for (let r = 0; r < ringCount; r += 1) {
    const radius = innerHole + (r + 0.5) * ringStep
    ringWeights[r] = radius
    totalWeight += radius
  }
  const perRing = new Int32Array(ringCount)
  let assigned = 0
  for (let r = 0; r < ringCount; r += 1) {
    perRing[r] = Math.max(1, Math.round((ringWeights[r] / totalWeight) * nodeCount))
    assigned += perRing[r]
  }
  perRing[ringCount - 1] = Math.max(1, perRing[ringCount - 1] + (nodeCount - assigned))

  const rng = mulberry32(seed)
  let idx = 0
  for (let r = 0; r < ringCount; r += 1) {
    const count = perRing[r]
    if (count <= 0) continue
    const radius = innerHole + (r + 0.5) * ringStep
    const angleStep = TAU / count
    // Each ring has its own random phase so dots don't visibly stack radially.
    const angleOffset = rng() * TAU
    for (let i = 0; i < count && idx < nodeCount; i += 1) {
      // Very small angular jitter only — keep rings crisp.
      const angularJitter = (rng() - 0.5) * angleStep * 0.08
      const a = angleOffset + i * angleStep + angularJitter
      positions[idx * 2] = cx + Math.cos(a) * radius
      positions[idx * 2 + 1] = cy + Math.sin(a) * radius
      idx += 1
    }
  }
  return positions
}

function mulberry32 (seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 0x1_0000_0000
  }
}
