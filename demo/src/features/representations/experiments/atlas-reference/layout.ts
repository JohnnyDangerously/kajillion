import type { DemoConfig } from '../../../control-plane/types'
import type { RepresentationVisualData } from '../../types'
import { readAtlasLayoutCache, writeAtlasLayoutCache } from './cache'
import { atlasClusterCenter } from './centers'
import {
  ATLAS_GROUP_COUNT,
  atlasGroupForNode,
  atlasHash,
  atlasSizeForNode,
  atlasTierForNode,
} from './metrics'
import { relaxAtlasOverlaps } from './relax'

export function atlasReferencePositions (data: RepresentationVisualData, cfg: DemoConfig): Float32Array {
  const seed = cfg.seed || 1
  const n = data.nodeCount
  const key = `${n}:${seed}`
  const cached = readAtlasLayoutCache(key)
  if (cached) return cached
  const positions = new Float32Array(n * 2)
  const radii = new Float32Array(n)
  const groupCounts = new Int32Array(ATLAS_GROUP_COUNT)
  const clusterCounts = new Int32Array(ATLAS_GROUP_COUNT * 96)
  const order = Array.from({ length: Math.max(0, n - 1) }, (_, i) => i + 1)
  order.sort((a, b) => atlasTierForNode(b, seed) - atlasTierForNode(a, seed))

  for (const node of order) {
    const group = atlasGroupForNode(node, n, seed)
    const groupIndex = groupCounts[group]++
    const clusterCount = clusterCountForGroup(n, group)
    const cluster = chooseCluster(node, groupIndex, clusterCount, seed)
    const slot = clusterCounts[group * 96 + cluster]++
    const center = atlasClusterCenter(group, cluster, seed)
    writeNode(positions, node, slot, center.x, center.y, group, seed)
    radii[node] = atlasSizeForNode(node, seed) * 0.5
  }
  relaxAtlasOverlaps(positions, radii, n > 50000 ? 2 : 4)
  writeAtlasLayoutCache(key, positions)
  return positions
}

function clusterCountForGroup (nodeCount: number, group: number): number {
  const base = Math.sqrt(nodeCount / ATLAS_GROUP_COUNT)
  return Math.max(24, Math.min(340, Math.round(base * 2.55 + (group % 5) * 7)))
}

function chooseCluster (node: number, groupIndex: number, count: number, seed: number): number {
  const local = groupIndex % count
  if (atlasHash(node * 73, seed) < 0.74) return local
  return Math.floor(atlasHash(node * 79 + groupIndex, seed) * count)
}

function writeNode (
  positions: Float32Array,
  node: number,
  slot: number,
  cx: number,
  cy: number,
  group: number,
  seed: number,
): void {
  const size = atlasSizeForNode(node, seed)
  const pitch = Math.max(16, size * 0.52)
  const angle = slot * 2.399963229728653 + atlasHash(node * 13, seed) * 0.22
  const radius = Math.sqrt(slot + 0.25) * pitch
  const lane = Math.sin(slot * 0.31 + group * 1.9) * pitch * 1.4
  positions[node * 2] = cx + Math.cos(angle) * radius + Math.cos(angle + Math.PI / 2) * lane
  positions[node * 2 + 1] = cy + Math.sin(angle) * radius * 0.82 + Math.sin(angle + Math.PI / 2) * lane
}
