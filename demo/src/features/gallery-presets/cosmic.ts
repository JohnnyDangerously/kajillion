import { mixedHash01 } from './utils'
import type { GalleryGraphData, LabelAnchor } from './types'

export function cosmicLabelAnchors (spaceSize: number): LabelAnchor[] {
  return [
    { label: 'YOU', x: spaceSize * 0.565, y: spaceSize * 0.515 },
    { label: 'SIGNAL CLUSTER', x: spaceSize * 0.245, y: spaceSize * 0.415 },
    { label: 'LIGHT PATHS', x: spaceSize * 0.718, y: spaceSize * 0.405 },
    { label: 'DARK FILAMENTS', x: spaceSize * 0.430, y: spaceSize * 0.650 },
  ]
}

export function cosmicScene<T extends GalleryGraphData> (data: T, spaceSize: number): T {
  const positions = new Float32Array(data.positions.length)
  const nodeCount = data.nodeCount
  const groupForNode = new Int32Array(nodeCount)
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

  if (nodeCount === 0) return { ...data, positions, links: new Float32Array(0), edgeCount: 0 }

  const clusters = [
    { x: 0.155, y: 0.355, rx: 0.092, ry: 0.032, angle: -0.52, group: 0, mass: 1.06 },
    { x: 0.295, y: 0.505, rx: 0.120, ry: 0.042, angle: 0.20, group: 1, mass: 1.22 },
    { x: 0.435, y: 0.350, rx: 0.108, ry: 0.039, angle: -0.24, group: 2, mass: 1.36 },
    { x: 0.565, y: 0.515, rx: 0.136, ry: 0.048, angle: 0.30, group: 3, mass: 1.58 },
    { x: 0.715, y: 0.405, rx: 0.104, ry: 0.036, angle: -0.16, group: 4, mass: 1.18 },
    { x: 0.840, y: 0.590, rx: 0.108, ry: 0.042, angle: 0.42, group: 5, mass: 0.96 },
    { x: 0.390, y: 0.690, rx: 0.138, ry: 0.039, angle: -0.06, group: 6, mass: 0.86 },
    { x: 0.625, y: 0.750, rx: 0.148, ry: 0.038, angle: 0.13, group: 7, mass: 0.78 },
  ]
  const hubs: number[] = []
  const members: number[][] = clusters.map(() => [])
  const totalMass = clusters.reduce((sum, c) => sum + c.mass, 0)
  const clusterForOrdinal = (ordinal: number): number => {
    const t = mixedHash01(ordinal, 24_019) * totalMass
    let acc = 0
    for (let i = 0; i < clusters.length; i += 1) {
      acc += clusters[i]!.mass
      if (t <= acc) return i
    }
    return clusters.length - 1
  }

  positions[0] = spaceSize * 0.565
  positions[1] = spaceSize * 0.520
  groupForNode[0] = 3

  for (let i = 0; i < Math.min(clusters.length, Math.max(0, nodeCount - 1)); i += 1) {
    const cluster = clusters[i]!
    const node = i + 1
    positions[node * 2] = spaceSize * cluster.x
    positions[node * 2 + 1] = spaceSize * cluster.y
    groupForNode[node] = cluster.group
    hubs[i] = node
    members[i]!.push(node)
  }

  for (let node = clusters.length + 1; node < nodeCount; node += 1) {
    const ci = clusterForOrdinal(node)
    const cluster = clusters[ci]!
    const angle = mixedHash01(node, 37_111) * Math.PI * 2
    const radial = Math.pow(mixedHash01(node, 42_227), 2.35)
    const filamentLane = (mixedHash01(node, 50_033) - 0.5) * 2
    const spine = Math.sin((node + ci * 137) * 0.031) * 0.24
    const ca = Math.cos(cluster.angle)
    const sa = Math.sin(cluster.angle)
    const localX = Math.cos(angle) * cluster.rx * radial + filamentLane * cluster.rx * 0.48 + spine * cluster.rx * 0.18
    const localY = Math.sin(angle) * cluster.ry * Math.sqrt(radial) + Math.sin(filamentLane * Math.PI) * cluster.ry * 0.34
    const voidDrift = mixedHash01(node, 71_221) > 0.986 ? 1.0 + mixedHash01(node, 72_007) * 0.62 : 1.0
    positions[node * 2] = spaceSize * (cluster.x + (localX * ca - localY * sa) * voidDrift)
    positions[node * 2 + 1] = spaceSize * (cluster.y + (localX * sa + localY * ca) * voidDrift)
    groupForNode[node] = cluster.group
    members[ci]!.push(node)
  }

  for (let ci = 0; ci < clusters.length; ci += 1) {
    const nodes = members[ci]!
    const hub = hubs[ci] ?? nodes[0] ?? 0
    for (let i = 1; i < nodes.length; i += 1) {
      const node = nodes[i]!
      const previous = nodes[i - 1] ?? hub
      if (i % 2 === 0) addLink(previous, node)
      if (i % 31 === 0) addLink(hub, node)
      if (i % 9 === 0) addLink(nodes[Math.floor(mixedHash01(node, 81_337) * i)] ?? hub, node)
      if (i % 19 === 0) addLink(nodes[Math.max(0, i - 13)] ?? hub, node)
    }
  }
  const web: Array<[number, number]> = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6], [6, 7], [7, 5],
    [1, 6], [3, 7], [0, 2], [4, 7], [0, 6], [3, 5], [1, 3], [4, 6],
  ]
  for (const [a, b] of web) {
    const ah = hubs[a] ?? -1
    const bh = hubs[b] ?? -1
    addLink(ah, bh)
    const left = members[a] ?? []
    const right = members[b] ?? []
    const bridgeCount = Math.min(54, Math.max(5, Math.floor((left.length + right.length) * 0.0032)))
    for (let i = 0; i < bridgeCount; i += 1) {
      addLink(
        left[Math.floor(mixedHash01(i + a * 1009, b * 733) * left.length)] ?? ah,
        right[Math.floor(mixedHash01(i + b * 1009, a * 733) * right.length)] ?? bh
      )
    }
  }
  const localUserGroup = members[3] ?? []
  for (let i = 0; i < Math.min(7, localUserGroup.length); i += 1) {
    const node = localUserGroup[Math.floor(mixedHash01(i, 91_337) * localUserGroup.length)]
    if (node !== undefined) addLink(0, node)
  }

  const out = { ...data, positions, links: new Float32Array(links), edgeCount: links.length / 2 }
  ;(out as GalleryGraphData & { groupForNode?: Int32Array }).groupForNode = groupForNode
  return out
}
