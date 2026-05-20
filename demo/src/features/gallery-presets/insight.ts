import { mixedHash01 } from './utils'
import type { GalleryGraphData, LabelAnchor } from './types'

export function insightScene<T extends GalleryGraphData> (data: T, spaceSize: number): T {
  const positions = new Float32Array(data.positions.length)
  const nodeCount = data.nodeCount
  const cx = spaceSize / 2
  const cy = spaceSize / 2
  const radius = spaceSize * 0.39
  const groupForNode = new Int32Array(nodeCount)
  groupForNode.fill(-1)
  const yellowCount = Math.min(Math.floor(nodeCount * 0.19), Math.max(0, nodeCount - 2))
  const magentaCount = Math.min(Math.floor(nodeCount * 0.23), Math.max(0, nodeCount - yellowCount - 1))
  const grayCount = Math.max(0, nodeCount - yellowCount - magentaCount)
  const gray: number[] = []
  const yellow: number[] = []
  const magenta: number[] = []

  for (let i = 0; i < grayCount; i += 1) {
    const node = i
    gray.push(node)
    const h = mixedHash01(node, 19)
    const angle = h * Math.PI * 2
    const h2 = mixedHash01(node, 251)
    const r = radius * (0.13 + Math.sqrt(mixedHash01(node, 881)) * 0.83 + (h2 > 0.84 ? 0.10 : 0))
    positions[node * 2] = cx + Math.cos(angle) * r * (0.95 + mixedHash01(node, 3) * 0.05)
    positions[node * 2 + 1] = cy + Math.sin(angle) * r * (0.92 + mixedHash01(node, 5) * 0.08)
  }

  const placeCommunity = (
    nodes: number[],
    start: number,
    count: number,
    group: number,
    centerX: number,
    centerY: number,
    spreadX: number,
    spreadY: number
  ): void => {
    for (let i = 0; i < count; i += 1) {
      const node = start + i
      nodes.push(node)
      groupForNode[node] = group
      const angle = mixedHash01(node, 73) * Math.PI * 2
      const r = Math.sqrt(mixedHash01(node, 173))
      positions[node * 2] = centerX + Math.cos(angle) * spreadX * r
      positions[node * 2 + 1] = centerY + Math.sin(angle) * spreadY * r
    }
  }
  placeCommunity(yellow, grayCount, yellowCount, 0, cx - radius * 0.30, cy + radius * 0.37, radius * 0.24, radius * 0.28)
  placeCommunity(magenta, grayCount + yellowCount, magentaCount, 1, cx + radius * 0.38, cy - radius * 0.25, radius * 0.29, radius * 0.28)

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
  const sortedByDistance = (node: number, nodes: number[]): number[] => {
    const ax = positions[node * 2] ?? cx
    const ay = positions[node * 2 + 1] ?? cy
    return [...nodes].sort((a, b) => {
      const adx = (positions[a * 2] ?? cx) - ax
      const ady = (positions[a * 2 + 1] ?? cy) - ay
      const bdx = (positions[b * 2] ?? cx) - ax
      const bdy = (positions[b * 2 + 1] ?? cy) - ay
      return adx * adx + ady * ady - (bdx * bdx + bdy * bdy)
    })
  }
  for (let i = 0; i < gray.length; i += 1) {
    const a = gray[i]!
    const near = sortedByDistance(a, gray)
    addLink(a, near[1 + Math.floor(mixedHash01(a, 31) * 5)] ?? gray[(i + 1) % gray.length]!)
    if (i % 2 === 0) addLink(a, near[4 + Math.floor(mixedHash01(a, 37) * 9)] ?? gray[(i + 7) % gray.length]!)
    if (i % 7 === 0) addLink(a, near[12 + Math.floor(mixedHash01(a, 41) * 20)] ?? gray[(i + 23) % gray.length]!)
  }
  const wireCommunity = (nodes: number[], bridge: number[]): void => {
    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i]!
      const near = sortedByDistance(a, nodes)
      addLink(a, near[1 + Math.floor(mixedHash01(a, 101) * 4)] ?? nodes[(i + 1) % nodes.length]!)
      addLink(a, near[4 + Math.floor(mixedHash01(a, 107) * 8)] ?? nodes[(i + 4) % nodes.length]!)
      if (i % 3 === 0) addLink(a, near[10 + Math.floor(mixedHash01(a, 109) * 12)] ?? nodes[(i + 11) % nodes.length]!)
      if (i % 5 === 0 && bridge.length > 0) addLink(a, bridge[Math.floor(mixedHash01(a, 909) * bridge.length) % bridge.length]!)
    }
  }
  wireCommunity(yellow, gray)
  wireCommunity(magenta, gray)
  for (let i = 0; i < Math.min(yellow.length, magenta.length); i += 9) {
    addLink(yellow[i]!, magenta[(i * 2 + 7) % magenta.length]!)
  }

  const out = { ...data, positions, links: new Float32Array(links), edgeCount: links.length / 2 }
  ;(out as GalleryGraphData & { groupForNode?: Int32Array }).groupForNode = groupForNode
  return out
}
