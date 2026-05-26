import { ATLAS_CLUSTERS, type AtlasCluster } from './overlay-clusters'
import { atlasHash, atlasSizeForNode } from './metrics'

export interface CandidateNode {
  node: number;
  group: number;
  clusterIndex: number;
  ax: number;
  ay: number;
  r: number;
}

export function candidateNode (
  index: number,
  total: number,
  nodeCount: number,
  seed: number,
  width: number,
  height: number,
): CandidateNode {
  const node = 1 + Math.floor(((index - 1) / Math.max(1, total - 1)) * Math.max(1, nodeCount - 2))
  const clusterIndex = clusterIndexForNode(node, seed)
  const cluster = ATLAS_CLUSTERS[clusterIndex]!
  const group = visualGroupForNode(node, cluster, seed)
  const anchor = nodeAnchor(node, seed, width, height)
  return { node, group, clusterIndex, ax: anchor.x, ay: anchor.y, r: nodeRadius(node, seed) }
}

function nodeAnchor (node: number, seed: number, width: number, height: number): { x: number; y: number } {
  const cluster = ATLAS_CLUSTERS[clusterIndexForNode(node, seed)]!
  const ca = atlasHash(node * 997, seed) * Math.PI * 2
  const cr = Math.pow(atlasHash(node * 43, seed), atlasHash(node * 113, seed) < 0.72 ? 0.62 : 0.38)
  const local = localOffset(node, seed)
  const bridge = bridgeOffset(node, seed)
  const ex = Math.cos(ca) * cr * cluster.rx * 0.94 + local.x * cluster.rx
  const ey = Math.sin(ca) * cr * cluster.ry * 0.94 + local.y * cluster.ry
  const x01 = cluster.x + ex * Math.cos(cluster.theta) - ey * Math.sin(cluster.theta) + bridge.x
  const y01 = cluster.y + ex * Math.sin(cluster.theta) + ey * Math.cos(cluster.theta) + bridge.y
  return { x: spread01(x01, 0.98) * width, y: spread01(y01, 0.95) * height }
}

function clusterIndexForNode (node: number, seed: number): number {
  const idx = Math.floor(atlasHash(node * 173, seed) * ATLAS_CLUSTERS.length)
  return Math.min(ATLAS_CLUSTERS.length - 1, idx)
}

function visualGroupForNode (node: number, cluster: AtlasCluster, seed: number): number {
  if (atlasHash(node * 181, seed) < 0.10) return Math.floor(atlasHash(node * 191, seed) * 13)
  return cluster.group
}

function nodeRadius (node: number, seed: number): number {
  const size = atlasSizeForNode(node, seed)
  const hero = atlasHash(node * 151, seed) > 0.988 ? 1.42 : 1
  return Math.max(1.25, Math.min(9.4, (size / 22) * hero))
}

function spread01 (value: number, scale: number): number {
  return Math.max(0.035, Math.min(0.965, 0.5 + (value - 0.5) * scale))
}

function localOffset (node: number, seed: number): { x: number; y: number } {
  const a = atlasHash(node * 157, seed) * Math.PI * 2
  const r = Math.pow(atlasHash(node * 163, seed), 1.55) * 0.22
  return { x: Math.cos(a) * r, y: Math.sin(a) * r }
}

function bridgeOffset (node: number, seed: number): { x: number; y: number } {
  if (atlasHash(node * 109, seed) >= 0.045) return { x: 0, y: 0 }
  const angle = atlasHash(node * 197, seed) * Math.PI * 2
  const dist = 0.035 + atlasHash(node * 199, seed) * 0.08
  return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist }
}
