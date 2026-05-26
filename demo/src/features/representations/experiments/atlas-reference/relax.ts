const CELL = 150
const PUSH = 0.58

export function relaxAtlasOverlaps (positions: Float32Array, radii: Float32Array, iterations: number): void {
  const count = radii.length
  const buckets = new Map<string, number[]>()
  for (let pass = 0; pass < iterations; pass += 1) {
    buckets.clear()
    for (let i = 1; i < count; i += 1) {
      const key = cellKey(positions[i * 2]!, positions[i * 2 + 1]!)
      let list = buckets.get(key)
      if (!list) {
        list = []
        buckets.set(key, list)
      }
      list.push(i)
    }
    for (let i = 1; i < count; i += 1) {
      pushFromNeighbors(i, positions, radii, buckets)
    }
  }
}

function pushFromNeighbors (
  i: number,
  positions: Float32Array,
  radii: Float32Array,
  buckets: Map<string, number[]>,
): void {
  const x = positions[i * 2]!
  const y = positions[i * 2 + 1]!
  const cx = Math.floor(x / CELL)
  const cy = Math.floor(y / CELL)
  for (let gx = cx - 1; gx <= cx + 1; gx += 1) {
    for (let gy = cy - 1; gy <= cy + 1; gy += 1) {
      const list = buckets.get(`${gx}:${gy}`)
      if (!list) continue
      for (const j of list) {
        if (j <= i) continue
        separatePair(i, j, positions, radii)
      }
    }
  }
}

function separatePair (i: number, j: number, positions: Float32Array, radii: Float32Array): void {
  const ia = i * 2
  const ja = j * 2
  const dx = positions[ja]! - positions[ia]!
  const dy = positions[ja + 1]! - positions[ia + 1]!
  const min = radii[i]! + radii[j]! + 3.5
  const d2 = dx * dx + dy * dy
  if (d2 >= min * min) return
  const d = Math.sqrt(Math.max(0.001, d2))
  const push = (min - d) * PUSH * 0.5
  const ux = dx / d
  const uy = dy / d
  positions[ia] -= ux * push
  positions[ia + 1] -= uy * push
  positions[ja] += ux * push
  positions[ja + 1] += uy * push
}

function cellKey (x: number, y: number): string {
  return `${Math.floor(x / CELL)}:${Math.floor(y / CELL)}`
}
