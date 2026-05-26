const HOP1_PACKING = 100

export const NETWORK_SCALE = 2.85
export const NETWORK_SPACE_CENTRE = 4096

export function getOuterRadius (positions: Float32Array, nodeCount: number): number {
  let outerRadius = 0
  for (let i = 0; i < nodeCount; i += 1) {
    const dx = (positions[i * 2] as number) - NETWORK_SPACE_CENTRE
    const dy = (positions[(i * 2) + 1] as number) - NETWORK_SPACE_CENTRE
    const r = Math.sqrt((dx * dx) + (dy * dy))
    if (r > outerRadius) outerRadius = r
  }
  return outerRadius
}

export function repackHop2Rings (
  positions: Float32Array,
  hops: Uint8Array,
  nodeCount: number,
): void {
  const hop1MaxR = getHop1MaxRadius(positions, hops, nodeCount)
  const hop2Indices: number[] = []
  for (let i = 0; i < nodeCount; i += 1) if (hops[i] === 2) hop2Indices.push(i)
  if (hop2Indices.length === 0) return

  hop2Indices.sort((a, b) => getSortRadius(positions, a) - getSortRadius(positions, b))

  const { ringCaps, ringRadii, total } = buildTargetRings(hop1MaxR, hop2Indices.length)
  let placed = 0
  for (let k = 0; k < ringRadii.length; k += 1) {
    const r = ringRadii[k] as number
    const isLast = k === ringRadii.length - 1
    const share = isLast
      ? hop2Indices.length - placed
      : Math.round((ringCaps[k] as number) * (hop2Indices.length / total))
    const slots = Math.max(1, share)
    // Golden-ratio phase offset per ring de-aliases angular alignment.
    const phase = ((k + 1) * 0.61803398) * Math.PI * 2
    for (let j = 0; j < slots; j += 1) {
      if (placed >= hop2Indices.length) break
      const theta = phase + ((j / slots) * Math.PI * 2)
      const idx = hop2Indices[placed] as number
      positions[idx * 2] = NETWORK_SPACE_CENTRE + (Math.cos(theta) * r)
      positions[(idx * 2) + 1] = NETWORK_SPACE_CENTRE + (Math.sin(theta) * r)
      placed += 1
    }
    if (placed >= hop2Indices.length) break
  }
}

function getHop1MaxRadius (
  positions: Float32Array,
  hops: Uint8Array,
  nodeCount: number,
): number {
  let hop1MaxR = 0
  for (let i = 0; i < nodeCount; i += 1) {
    if (hops[i] !== 1) continue
    const r = getRadius(positions, i)
    if (r > hop1MaxR) hop1MaxR = r
  }
  return hop1MaxR
}

function getRadius (positions: Float32Array, index: number): number {
  const dx = (positions[index * 2] as number) - NETWORK_SPACE_CENTRE
  const dy = (positions[(index * 2) + 1] as number) - NETWORK_SPACE_CENTRE
  return Math.sqrt((dx * dx) + (dy * dy))
}

function getSortRadius (positions: Float32Array, index: number): number {
  return Math.hypot(
    (positions[index * 2] as number) - NETWORK_SPACE_CENTRE,
    (positions[(index * 2) + 1] as number) - NETWORK_SPACE_CENTRE,
  )
}

function buildTargetRings (
  hop1MaxR: number,
  hop2Count: number,
): { ringCaps: number[], ringRadii: number[], total: number } {
  const ringRadii: number[] = []
  const ringCaps: number[] = []
  let total = 0
  for (let k = 1; total < hop2Count; k += 1) {
    const r = hop1MaxR + (k * HOP1_PACKING)
    const cap = Math.max(8, Math.floor((2 * Math.PI * r) / HOP1_PACKING))
    ringRadii.push(r)
    ringCaps.push(cap)
    total += cap
  }
  return { ringCaps, ringRadii, total }
}
