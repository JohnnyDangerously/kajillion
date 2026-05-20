import { mixedHash01 } from './utils'
import type { GalleryGraphData, LabelAnchor } from './types'

export function influenceLabelAnchors (spaceSize: number): LabelAnchor[] {
  const p = (label: string, nx: number, ny: number): LabelAnchor => ({
    label,
    x: spaceSize * nx,
    y: spaceSize * ny,
  })
  return [
    p('microchunkychip', 0.51, 0.50),
    p('thedemocrats', 0.66, 0.68),
    p('speakerryan', 0.36, 0.32),
    p('whiteofpeace', 0.25, 0.62),
    p('realjamesallsup', 0.25, 0.71),
    p('cnn', 0.42, 0.66),
    p('bakedalaska', 0.69, 0.20),
    p('realdonaldtrump', 0.45, 0.35),
    p('washingtonpost', 0.52, 0.88),
    p('wikileaks', 0.57, 0.90),
    p('russianembassy', 0.49, 0.91),
    p('foxandfriends', 0.22, 0.27),
    p('breitbartnews', 0.45, 0.38),
    p('drudge_report', 0.60, 0.20),
    p('newsmax', 0.54, 0.25),
    p('youtube', 0.64, 0.28),
    p('msnbc', 0.67, 0.42),
    p('huffpost', 0.69, 0.46),
    p('politico', 0.23, 0.46),
    p('potus', 0.28, 0.50),
    p('foxnews', 0.34, 0.53),
    p('nypost', 0.78, 0.39),
    p('mfa_russia', 0.87, 0.35),
    p('breaking911', 0.74, 0.45),
    p('lucianwintrich', 0.55, 0.17),
    p('ramzpaul', 0.32, 0.23),
    p('tedcruz', 0.42, 0.26),
    p('jaredkushner', 0.20, 0.35),
    p('hillaryclinton', 0.50, 0.31),
    p('facebook', 0.33, 0.57),
    p('mashable', 0.39, 0.58),
  ]
}

export function influenceScene<T extends GalleryGraphData> (data: T, spaceSize: number): T {
  const positions = new Float32Array(data.positions.length)
  const nodeCount = data.nodeCount
  const cx = spaceSize * 0.51
  const cy = spaceSize * 0.50
  const radius = spaceSize * 0.48
  const groupForNode = new Int32Array(nodeCount)
  groupForNode.fill(0)
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
  positions[0] = cx
  positions[1] = cy
  groupForNode[0] = 0

  const clusters = [
    { group: 0, start: 1, end: Math.floor(nodeCount * 0.42), x: 0.51, y: 0.50, rx: 0.36, ry: 0.30, hub: 0, radial: true },
    { group: 0, start: Math.floor(nodeCount * 0.42), end: Math.floor(nodeCount * 0.62), x: 0.63, y: 0.64, rx: 0.27, ry: 0.24, hub: 2, radial: true },
    { group: 1, start: Math.floor(nodeCount * 0.62), end: Math.floor(nodeCount * 0.78), x: 0.37, y: 0.37, rx: 0.29, ry: 0.24, hub: 1, radial: true },
    { group: 2, start: Math.floor(nodeCount * 0.78), end: Math.floor(nodeCount * 0.84), x: 0.25, y: 0.58, rx: 0.18, ry: 0.20, hub: 3, radial: false },
    { group: 3, start: Math.floor(nodeCount * 0.84), end: Math.floor(nodeCount * 0.91), x: 0.45, y: 0.76, rx: 0.27, ry: 0.19, hub: 4, radial: false },
    { group: 4, start: Math.floor(nodeCount * 0.91), end: Math.floor(nodeCount * 0.96), x: 0.66, y: 0.30, rx: 0.25, ry: 0.21, hub: 5, radial: false },
    { group: 5, start: Math.floor(nodeCount * 0.96), end: nodeCount, x: 0.76, y: 0.46, rx: 0.20, ry: 0.21, hub: 6, radial: false },
  ]
  const hubs: number[] = [0]
  for (const cluster of clusters) {
    const hub = Math.min(nodeCount - 1, Math.max(cluster.start, cluster.hub))
    hubs.push(hub)
    for (let node = cluster.start; node < cluster.end; node += 1) {
      const angle = mixedHash01(node, 331 + cluster.group) * Math.PI * 2
      const r = Math.sqrt(mixedHash01(node, 733 + cluster.group))
      const jitter = mixedHash01(node, 991 + cluster.group)
      positions[node * 2] = spaceSize * cluster.x + Math.cos(angle) * radius * cluster.rx * r
      positions[node * 2 + 1] = spaceSize * cluster.y + Math.sin(angle) * radius * cluster.ry * r
      groupForNode[node] = cluster.group
      if (cluster.radial && node % 2 === 0) addLink(0, node)
      if (node > cluster.start) addLink(node, node - 1)
      if (node % 3 === 0) addLink(node, cluster.start + Math.floor(jitter * Math.max(1, node - cluster.start)))
      if (node % 17 === 0) addLink(node, hub)
    }
  }
  for (let i = 0; i < hubs.length; i += 1) {
    addLink(hubs[i]!, hubs[(i + 1) % hubs.length]!)
    if (i > 1) addLink(hubs[i]!, 0)
  }
  const out = { ...data, positions, links: new Float32Array(links), edgeCount: links.length / 2 }
  ;(out as GalleryGraphData & { groupForNode?: Int32Array }).groupForNode = groupForNode
  return out
}
