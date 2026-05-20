import { hash01 } from './utils'
import type { GalleryGraphData } from './types'

export function tokyoScene<T extends GalleryGraphData> (data: T, spaceSize: number): T {
  const positions = new Float32Array(data.positions.length)
  const cx = spaceSize / 2
  const cy = spaceSize / 2
  const radius = spaceSize * 0.405
  const nodeCount = data.nodeCount
  if (nodeCount === 0) return { ...data, positions, links: new Float32Array(0), edgeCount: 0 }
  const satelliteCount = Math.max(0, Math.min(30, Math.floor(nodeCount * 0.055)))
  const meshCount = Math.max(1, nodeCount - satelliteCount)
  const ringCount = Math.max(8, Math.min(18, Math.round(Math.sqrt(meshCount) * 0.70)))
  const rings: number[][] = Array.from({ length: ringCount }, () => [])
  const weights: number[] = []
  let totalWeight = 0
  for (let ring = 0; ring < ringCount; ring += 1) {
    const t = ringCount === 1 ? 1 : ring / (ringCount - 1)
    const r = 0.19 + Math.pow(t, 0.90) * 0.81
    const rimBoost = ring > ringCount - 5 ? 1.95 : ring < 3 ? 0.68 : 1
    const weight = Math.max(0.16, r * rimBoost)
    weights.push(weight)
    totalWeight += weight
  }
  let assigned = 0
  for (let ring = 0; ring < ringCount; ring += 1) {
    const remainingRings = ringCount - ring - 1
    const target = Math.max(4, Math.round((weights[ring]! / totalWeight) * meshCount))
    const count = ring === ringCount - 1 ? meshCount - assigned : Math.min(target, meshCount - assigned - remainingRings * 4)
    for (let j = 0; j < count && assigned < meshCount; j += 1) {
      rings[ring]!.push(assigned)
      assigned += 1
    }
  }

  for (const [ring, ring_] of rings.entries()) {
    const nodes = ring_!
    const t = ringCount === 1 ? 1 : ring / (ringCount - 1)
    const ringRadius = 0.19 + Math.pow(t, 0.90) * 0.81
    const angleOffset = ring * 0.27 + Math.sin(ring * 1.7) * 0.045
    for (let j = 0; j < nodes.length; j += 1) {
      const node = nodes[j]!
      const t = j / nodes.length
      const angle = t * Math.PI * 2 + angleOffset + (hash01(node + 13) - 0.5) * 0.028
      const tangentNoise = (hash01(node + 301) - 0.5) * radius * 0.018
      const radialNoise = (hash01(node + 907) - 0.5) * radius * (ring > ringCount - 5 ? 0.020 : 0.034)
      const ySqueeze = 0.99 + Math.sin(angle * 2.0 + ring) * 0.012
      positions[node * 2] = cx + Math.cos(angle) * (radius * ringRadius + radialNoise) + Math.cos(angle + Math.PI / 2) * tangentNoise
      positions[node * 2 + 1] = cy + Math.sin(angle) * (radius * ringRadius + radialNoise) * ySqueeze + Math.sin(angle + Math.PI / 2) * tangentNoise
    }
  }

  for (let node = meshCount; node < nodeCount; node += 1) {
    const t = (node - meshCount) / Math.max(1, satelliteCount)
    const angle = t * Math.PI * 2 + hash01(node + 409) * 0.32
    const r = 1.08 + hash01(node + 977) * 0.18
    positions[node * 2] = cx + Math.cos(angle) * radius * r
    positions[node * 2 + 1] = cy + Math.sin(angle) * radius * r * 0.985
  }

  const links: number[] = []
  const seenLinks = new Set<string>()
  const addLink = (a: number, b: number): void => {
    if (a === b || a < 0 || b < 0 || a >= nodeCount || b >= nodeCount) return
    const low = Math.min(a, b)
    const high = Math.max(a, b)
    const key = `${low}:${high}`
    if (seenLinks.has(key)) return
    seenLinks.add(key)
    links.push(a, b)
  }
  for (let ring = 0; ring < rings.length; ring += 1) {
    const nodes = rings[ring]!
    const nextRing = rings[ring + 1]
    for (let j = 0; j < nodes.length; j += 1) {
      const a = nodes[j]!
      if (ring > rings.length - 4) addLink(a, nodes[(j + 1) % nodes.length]!)
      if (ring > rings.length - 6 && j % 2 === 0) addLink(a, nodes[(j + 2) % nodes.length]!)
      if (ring > rings.length - 4 && j % 5 === 0) addLink(a, nodes[(j + Math.floor(nodes.length * 0.08)) % nodes.length]!)
      if (nextRing && nextRing.length > 0) {
        const t = j / nodes.length
        const k = Math.floor(t * nextRing.length)
        addLink(a, nextRing[k % nextRing.length]!)
        addLink(a, nextRing[(k + 1) % nextRing.length]!)
        if (j % 3 === 0) addLink(a, nextRing[(k + nextRing.length - 1) % nextRing.length]!)
        if (ring > rings.length - 6 && j % 4 === 0) addLink(a, nextRing[(k + 3) % nextRing.length]!)
      }
      if (ring > 0 && ring < rings.length - 2 && j % 4 === 0) {
        const chordRing = rings[Math.min(rings.length - 1, ring + 2 + (j % 2))]!
        const k = Math.floor((j / nodes.length) * chordRing.length + chordRing.length * (j % 8 === 0 ? 0.21 : -0.15))
        addLink(a, chordRing[k % chordRing.length]!)
      }
      if (ring > 2 && ring < rings.length - 3 && j % 11 === 0) {
        const chordRing = rings[Math.max(0, ring - 2)]!
        const k = Math.floor((j / nodes.length) * chordRing.length + chordRing.length * 0.37)
        addLink(a, chordRing[k % chordRing.length]!)
      }
    }
  }
  const outer = rings[rings.length - 1] ?? []
  for (let node = meshCount; node < nodeCount; node += 1) {
    if (outer.length === 0) break
    const k = Math.floor(hash01(node + 4_091) * outer.length)
    addLink(node, outer[k % outer.length]!)
    if (node % 4 === 0) addLink(node, outer[(k + Math.floor(outer.length * 0.11)) % outer.length]!)
  }
  const redSectorNodes: number[] = []
  for (let node = 0; node < meshCount; node += 1) {
    const x = positions[node * 2] ?? cx
    const y = positions[node * 2 + 1] ?? cy
    const dx = x - cx
    const dy = y - cy
    const r = Math.hypot(dx, dy) / radius
    if (dx > radius * 0.02 && dy < radius * 0.28 && dy > -radius * 0.82 && r > 0.32) redSectorNodes.push(node)
  }
  redSectorNodes.sort((a, b) => {
    const aa = Math.atan2((positions[a * 2 + 1] ?? cy) - cy, (positions[a * 2] ?? cx) - cx)
    const bb = Math.atan2((positions[b * 2 + 1] ?? cy) - cy, (positions[b * 2] ?? cx) - cx)
    return aa - bb
  })
  for (let i = 0; i < redSectorNodes.length; i += 1) {
    const a = redSectorNodes[i]!
    addLink(a, redSectorNodes[(i + 1) % redSectorNodes.length]!)
    addLink(a, redSectorNodes[(i + 2) % redSectorNodes.length]!)
    if (i % 2 === 0) addLink(a, redSectorNodes[(i + 5) % redSectorNodes.length]!)
    if (i % 4 === 0) addLink(a, redSectorNodes[(i + Math.floor(redSectorNodes.length * 0.28)) % redSectorNodes.length]!)
  }
  return { ...data, positions, links: new Float32Array(links), edgeCount: links.length / 2 }
}
