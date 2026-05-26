import { atlasHash } from '../atlas-reference/metrics'
import { ATLAS_CLUSTERS } from './layout-clusters'
import { packAtlasNodes } from './layout-pack'
import type { CloudEdge, CloudNode, CloudScene } from './types'

export function buildReferenceCloudScene (nodeCount: number, seed: number): CloudScene {
  const target = Math.min(Math.max(3200, Math.floor(nodeCount * 0.052)), 6200)
  const nodes = packAtlasNodes(target, seed)
  const edges = buildEdges(nodes, seed)
  return { nodes, edges, metrics: sceneMetrics(nodes, edges) }
}

function buildEdges (nodes: CloudNode[], seed: number): CloudEdge[] {
  const edges: CloudEdge[] = []
  const buckets = clusterBuckets(nodes)
  for (let i = 0; i < nodes.length; i += 1) {
    if (atlasHash(i * 67, seed) < 0.28) continue
    const a = nodes[i]!
    const local = buckets.get(a.cluster) ?? nodes
    const b = nearbyNode(a, local, i, seed) ?? nodes[(i + 17) % nodes.length]!
    if (b.id !== a.id) edges.push(edge(i, b.id - 1, false, a.radius))
    const c = atlasHash(i * 109, seed) > 0.42 ? nearbyNode(a, local, i + 211, seed) : null
    if (c && c.id !== a.id && c.id !== b.id) edges.push(edge(i, c.id - 1, false, a.radius))
  }
  addBridgeEdges(edges, buckets, seed)
  return edges
}

function nearbyNode (node: CloudNode, pool: CloudNode[], i: number, seed: number): CloudNode | null {
  let best: CloudNode | null = null
  let bestD = Infinity
  for (let k = 0; k < 8; k += 1) {
    const pick = pool[Math.floor(atlasHash(i * 71 + k * 107, seed) * pool.length)]
    if (!pick || pick.id === node.id) continue
    const d = (node.x - pick.x) ** 2 + (node.y - pick.y) ** 2
    if (d < bestD) { best = pick; bestD = d }
  }
  return best
}

function clusterBuckets (nodes: CloudNode[]): Map<number, CloudNode[]> {
  const buckets = new Map<number, CloudNode[]>()
  for (const node of nodes) {
    const list = buckets.get(node.cluster) ?? []
    list.push(node)
    buckets.set(node.cluster, list)
  }
  return buckets
}

function addBridgeEdges (edges: CloudEdge[], buckets: Map<number, CloudNode[]>, seed: number): void {
  for (let i = 0; i < ATLAS_CLUSTERS.length; i += 1) {
    const a = buckets.get(i) ?? []
    const b = buckets.get((i + 3 + Math.floor(atlasHash(i * 83, seed) * 7)) % ATLAS_CLUSTERS.length) ?? []
    const count = Math.min(9, a.length, b.length)
    for (let j = 0; j < count; j += 1) {
      const source = a[Math.floor(atlasHash(i * 89 + j, seed) * a.length)]!
      const target = b[Math.floor(atlasHash(i * 91 + j, seed) * b.length)]!
      edges.push(edge(source.id - 1, target.id - 1, true, source.radius))
    }
  }
}

function edge (a: number, b: number, bridge: boolean, radius: number): CloudEdge {
  return { a, b, bridge, alpha: bridge ? 0.24 : 0.075, width: bridge ? 0.62 : Math.max(0.22, radius * 0.035) }
}

function sceneMetrics (nodes: CloudNode[], edges: CloudEdge[]): Record<string, number> {
  const tiny = nodes.filter((n) => n.radius <= 2).length / nodes.length
  const large = nodes.filter((n) => n.radius >= 5).length / nodes.length
  const core = nodes.filter((n) => Math.abs(n.x) < 0.7 && Math.abs(n.y) < 0.7).length / nodes.length
  return { visibleNodeCount: nodes.length, visibleEdgeCount: edges.length, percentTiny: tiny, percentLarge: large, central70: core }
}
