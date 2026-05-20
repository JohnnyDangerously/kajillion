/**
 * Deterministic ego-network layout. The focus node sits at the centre; its
 * neighbours fall into uneven lobes by rank so the skeleton reads as a graph
 * structure instead of a perfect generated spiral. Instant, no force sim.
 */

const LOBES = [
  { angle: -2.58, spread: 0.34, depth: 0.94, width: 1.12 },
  { angle: -1.72, spread: 0.26, depth: 0.86, width: 0.88 },
  { angle: -0.70, spread: 0.38, depth: 1.02, width: 1.08 },
  { angle: 0.18, spread: 0.28, depth: 0.82, width: 0.92 },
  { angle: 0.98, spread: 0.36, depth: 1.05, width: 1.20 },
  { angle: 1.88, spread: 0.30, depth: 0.90, width: 0.84 },
  { angle: 2.72, spread: 0.40, depth: 1.00, width: 1.04 },
]

function hash01 (index: number, salt: number): number {
  let x = Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca77)
  x ^= x >>> 16
  x = Math.imul(x, 0x7feb352d)
  x ^= x >>> 15
  x = Math.imul(x, 0x846ca68b)
  x ^= x >>> 16
  return (x >>> 0) / 0x1_0000_0000
}

/**
 * @returns flat [x0, y0, x1, y1, ...] — index 0 is the focus node, then
 *          one entry per neighbour in the order given.
 */
export function radialLayout (neighborCount: number, spaceSize: number): number[] {
  const center = spaceSize / 2
  const positions: number[] = [center, center]
  const rMin = spaceSize * 0.060
  const rMax = spaceSize * 0.455
  const lobeCounts = new Array<number>(LOBES.length).fill(0)
  for (let i = 0; i < neighborCount; i += 1) {
    const frac = neighborCount > 1 ? i / (neighborCount - 1) : 0
    const lobeIndex = Math.floor(hash01(i, 17) * LOBES.length) % LOBES.length
    const lobe = LOBES[lobeIndex] ?? LOBES[0]!
    const ordinal = lobeCounts[lobeIndex] ?? 0
    lobeCounts[lobeIndex] = ordinal + 1
    const ring = Math.floor(ordinal / 18)
    const rankRadius = rMin + (rMax - rMin) * Math.pow(frac, 0.56) * lobe.depth
    const localRadius = rankRadius + ring * spaceSize * 0.010 + (hash01(i, 31) - 0.5) * spaceSize * 0.025
    const theta = lobe.angle + (hash01(i, 47) - 0.5) * lobe.spread + ordinal * 0.018
    const tangent = (hash01(i, 73) - 0.5) * spaceSize * 0.075 * lobe.width
    const normal = theta + Math.PI / 2
    positions.push(
      center + localRadius * Math.cos(theta) + tangent * Math.cos(normal),
      center + localRadius * Math.sin(theta) + tangent * Math.sin(normal),
    )
  }
  return positions
}
