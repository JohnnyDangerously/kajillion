import { ATLAS_COLORS, atlasHash } from './metrics'
import { candidateNode, type CandidateNode } from './overlay-candidates'
import type { AtlasDrawPoint } from './overlay-point'
import { buildAtlasTexturePoints } from './overlay-texture'

export function buildAtlasDrawPoints (
  nodeCount: number,
  seed: number,
  width: number,
  height: number,
): AtlasDrawPoint[] {
  const total = Math.min(nodeCount - 1, 22000)
  const nodes = Array.from({ length: total }, (_, index) => candidateNode(index + 1, total, nodeCount, seed, width, height))
  const glyphs = packNodes(nodes, width, height)
  glyphs.push(...buildAtlasTexturePoints(nodeCount, seed, width, height, glyphs.length))
  return glyphs
}

export function atlasColorForGroup (group: number): readonly [number, number, number] {
  return ATLAS_COLORS[group % ATLAS_COLORS.length]!
}

interface PlacedPoint {
  x: number;
  y: number;
  r: number;
  clusterIndex: number;
}

function packNodes (nodes: CandidateNode[], width: number, height: number): AtlasDrawPoint[] {
  const buckets = new Map<string, PlacedPoint[]>()
  const cell = 20
  const points: AtlasDrawPoint[] = []
  nodes.sort((a, b) => priority(b) - priority(a))
  for (const node of nodes) {
    const placed = placeNode(node, buckets, cell, width, height)
    if (!placed) continue
    points.push({ node: node.node, group: node.group, x: placed.x, y: placed.y, r: placed.r })
    addBucket(buckets, cell, placed)
  }
  return points
}

function placeNode (
  node: CandidateNode,
  buckets: Map<string, PlacedPoint[]>,
  cell: number,
  width: number,
  height: number,
): PlacedPoint | null {
  let best: PlacedPoint | null = null
  let bestCost = Infinity
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const point = candidatePosition(node, attempt)
    if (!inBounds(point, width, height)) continue
    const cost = overlapCost(point, buckets, cell)
    if (cost === 0) return point
    if (cost < bestCost) {
      best = point
      bestCost = cost
    }
  }
  return bestCost < 0.025 ? best : null
}

function candidatePosition (node: CandidateNode, attempt: number): PlacedPoint {
  if (attempt === 0) return { x: node.ax, y: node.ay, r: node.r, clusterIndex: node.clusterIndex }
  const angle = attempt * 2.399963229728653 + atlasHash(node.node * 13, attempt) * 0.2
  const distance = Math.sqrt(attempt) * (node.r * 0.35 + 0.16)
  return {
    x: node.ax + Math.cos(angle) * distance,
    y: node.ay + Math.sin(angle) * distance,
    r: node.r,
    clusterIndex: node.clusterIndex,
  }
}

function inBounds (point: PlacedPoint, width: number, height: number): boolean {
  return point.x > point.r && point.y > point.r && point.x < width - point.r && point.y < height - point.r
}

function overlapCost (point: PlacedPoint, buckets: Map<string, PlacedPoint[]>, cell: number): number {
  let cost = 0
  const cx = Math.floor(point.x / cell)
  const cy = Math.floor(point.y / cell)
  for (let x = cx - 1; x <= cx + 1; x += 1) {
    for (let y = cy - 1; y <= cy + 1; y += 1) {
      const list = buckets.get(`${x}:${y}`)
      if (!list) continue
      for (const other of list) cost += pairOverlap(point, other)
    }
  }
  return cost
}

function pairOverlap (a: PlacedPoint, b: PlacedPoint): number {
  const min = a.r + b.r + pairGap(a, b)
  const dx = a.x - b.x
  const dy = a.y - b.y
  const d2 = dx * dx + dy * dy
  if (d2 >= min * min) return 0
  return (min * min - d2) / (min * min)
}

function pairGap (a: PlacedPoint, b: PlacedPoint): number {
  if (a.clusterIndex !== b.clusterIndex) return 5.8
  if (Math.max(a.r, b.r) > 6.8) return 1.2
  return Math.min(a.r, b.r) < 2.4 ? 0.1 : 0.32
}

function priority (node: CandidateNode): number {
  const filler = node.r < 2.7 ? 58 : 0
  return node.r * 100 + filler
}

function addBucket (buckets: Map<string, PlacedPoint[]>, cell: number, point: PlacedPoint): void {
  const key = `${Math.floor(point.x / cell)}:${Math.floor(point.y / cell)}`
  const list = buckets.get(key)
  if (list) list.push(point)
  else buckets.set(key, [point])
}
