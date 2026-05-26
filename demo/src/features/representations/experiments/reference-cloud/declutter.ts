import { GlyphOccupancyMask, type GlyphCircle } from './declutter-mask'
import type { ProjectedNode } from './project'
import { ringThickness, type ZoomBand } from './zoom-band'

export interface DeclutterMetrics {
  acceptedFullGlyphCount: number;
  rejectedNodeCount: number;
  rejectedDueToOcclusionCount: number;
  rejectedTextureRenderCount: number;
  densityNodeCount: number;
  occupancyGridCellSize: number;
  occupiedCellPercent: number;
  tileBudgetHitCount: number;
  declutterTimeMs: number;
}

export function declutterGlyphs (
  nodes: ProjectedNode[],
  width: number,
  height: number,
  band: ZoomBand,
  previous: Set<number>,
): DeclutterMetrics {
  const started = performance.now()
  const cell = band.id === 'macro' ? 8 : 4
  const mask = new GlyphOccupancyMask(width, height, cell)
  const accepted = new Set<number>()
  let rejected = 0
  for (const i of priorityOrder(nodes, previous)) {
    const node = nodes[i]!
    if (node.renderHidden || node.vr < 0.7) {
      node.renderMode = 'hidden'
      continue
    }
    const glyph = glyphCircle(node)
    if (!mask.wouldCreateOcclusion(glyph)) {
      mask.mark(glyph)
      node.renderMode = 'full'
      accepted.add(node.id)
    } else {
      node.renderMode = 'texture'
      node.renderAlpha = textureAlpha(node)
      rejected += 1
    }
  }
  previous.clear()
  for (const id of accepted) previous.add(id)
  return {
    acceptedFullGlyphCount: accepted.size,
    rejectedNodeCount: rejected,
    rejectedDueToOcclusionCount: rejected,
    rejectedTextureRenderCount: rejected,
    densityNodeCount: rejected,
    occupancyGridCellSize: cell,
    occupiedCellPercent: mask.occupiedPercent(),
    tileBudgetHitCount: 0,
    declutterTimeMs: performance.now() - started,
  }
}

function priorityOrder (nodes: ProjectedNode[], previous: Set<number>): number[] {
  const landmark: Array<{ index: number; score: number }> = []
  const filler: Array<{ index: number; score: number }> = []
  const structural: Array<{ index: number; score: number }> = []
  nodes.forEach((node, index) => {
    const entry = { index, score: priority(node, previous) }
    if (node.vr >= 5.6 || isSpecial(node)) landmark.push(entry)
    else if (node.vr <= 2.55) filler.push(entry)
    else structural.push(entry)
  })
  landmark.sort((a, b) => b.score - a.score)
  filler.sort((a, b) => b.score - a.score)
  structural.sort((a, b) => b.score - a.score)
  return [...landmark, ...filler, ...structural].map((entry) => entry.index)
}

function priority (node: ProjectedNode, previous: Set<number>): number {
  return specialPriority(node) +
    node.importance * 300 +
    rankPriority(node) +
    (node.bridge ? 120 : 0) +
    Math.max(0, node.depth) * 35 +
    Math.min(60, node.vr * 8) +
    (previous.has(node.id) ? 28 : 0) +
    stableNoise(node.id)
}

function specialPriority (node: ProjectedNode): number {
  return isSpecial(node) ? 100_000 : 0
}

function isSpecial (node: ProjectedNode): boolean {
  const flags = node as ProjectedNode & {
    selected?: boolean;
    searchHit?: boolean;
    matchedSearch?: boolean;
    path?: boolean;
    pathNode?: boolean;
  }
  return Boolean(flags.selected || flags.searchHit || flags.matchedSearch || flags.path || flags.pathNode)
}

function rankPriority (node: ProjectedNode): number {
  const rank = (node as ProjectedNode & { rank?: number }).rank
  return typeof rank === 'number' && Number.isFinite(rank) ? 250 / (1 + Math.max(0, rank)) : 0
}

function stableNoise (value: number): number {
  const x = Math.sin(value * 78.233) * 43758.5453
  return x - Math.floor(x)
}

function glyphCircle (node: ProjectedNode): GlyphCircle {
  const outerR = Math.max(0.55, node.vr)
  return {
    x: node.sx,
    y: node.sy,
    fillR: Math.max(0.34, outerR - ringThickness(outerR)),
    outerR,
    cluster: node.cluster,
  }
}

function textureAlpha (node: ProjectedNode): number {
  return Math.max(0.06, Math.min(0.22, 0.08 + node.importance * 0.08 + node.depth * 0.035))
}
