import { ATLAS_CLUSTERS } from './overlay-clusters'
import { atlasHash } from './metrics'
import type { AtlasDrawPoint } from './overlay-point'

export function buildAtlasTexturePoints (
  nodeCount: number,
  seed: number,
  width: number,
  height: number,
  offset: number,
): AtlasDrawPoint[] {
  const total = Math.min(Math.max(0, nodeCount - offset - 1), 30000)
  return Array.from({ length: total }, (_, index) => texturePoint(index + offset + 1, seed, width, height))
}

function texturePoint (node: number, seed: number, width: number, height: number): AtlasDrawPoint {
  const cluster = ATLAS_CLUSTERS[clusterIndexForNode(node * 5 + 11, seed)]!
  const angle = atlasHash(node * 271, seed) * Math.PI * 2
  const radius = Math.pow(atlasHash(node * 277, seed), 0.64)
  const ex = Math.cos(angle) * radius * cluster.rx * 1.08
  const ey = Math.sin(angle) * radius * cluster.ry * 1.08
  const x = spread01(cluster.x + ex * Math.cos(cluster.theta) - ey * Math.sin(cluster.theta), 0.98) * width
  const y = spread01(cluster.y + ex * Math.sin(cluster.theta) + ey * Math.cos(cluster.theta), 0.95) * height
  return { node, group: cluster.group, x, y, r: 0.36 + atlasHash(node * 283, seed) * 0.72, texture: true }
}

function clusterIndexForNode (node: number, seed: number): number {
  const idx = Math.floor(atlasHash(node * 173, seed) * ATLAS_CLUSTERS.length)
  return Math.min(ATLAS_CLUSTERS.length - 1, idx)
}

function spread01 (value: number, scale: number): number {
  return Math.max(0.035, Math.min(0.965, 0.5 + (value - 0.5) * scale))
}
