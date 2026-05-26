import { cloudColor, rgb255 } from './colors'
import { relaxPriorityCollisions, type CollisionMetrics, type CollisionPolicy } from './collision'
import { declutterGlyphs, type DeclutterMetrics } from './declutter'
import { countFullNodeOverlaps } from './overlap-audit'
import { projectNode, type ProjectedNode } from './project'
import type { CloudView } from './types'
import { applyZoomBandRadii, resolveZoomBand, ringThickness, type ZoomBand } from './zoom-band'

export function drawReferenceCloud (g: CanvasRenderingContext2D, view: CloudView, seed: number): void {
  const started = performance.now()
  const scene = view.scene
  if (!scene) return
  const projected = scene.nodes.map((n) => projectNode(n, view.width, view.height, view.scale, view.panX, view.panY, view.roll, view.yaw, view.pitch))
  const band = resolveZoomBand(view.scale)
  applyZoomBandRadii(projected, band)
  const declutter = declutterGlyphs(projected, view.width, view.height, band, view.acceptedGlyphs)
  const collision = relaxPriorityCollisions(projected, band, collisionPolicy(view, band))
  const sorted = [...projected].sort((a, b) => a.depth - b.depth)
  g.fillStyle = '#000'
  g.fillRect(0, 0, view.width, view.height)
  drawEdges(g, projected, view, seed, band)
  for (const node of sorted) drawTextureNode(g, node, seed)
  for (const node of sorted) drawNode(g, node, seed, band)
  exposeDebug(scene.metrics, projected, view, band, collision, declutter, performance.now() - started)
}

function collisionPolicy (view: CloudView, band: ZoomBand): CollisionPolicy {
  const cameraMoving = view.dragging || performance.now() < view.interactionUntil
  return { enabled: false, maxCandidates: 0, iterations: 0, cameraMoving }
}

function drawEdges (g: CanvasRenderingContext2D, nodes: ProjectedNode[], view: CloudView, seed: number, band: ZoomBand): void {
  const scene = view.scene
  if (!scene) return
  g.lineCap = 'round'
  g.globalCompositeOperation = 'source-over'
  for (const edge of scene.edges) {
    const a = nodes[edge.a]
    const b = nodes[edge.b]
    if (!a || !b) continue
    const color = edge.bridge
      ? cloudColor(a.group, edge.a, seed)
      : cloudColor(a.group, edge.b, seed)
    const hiddenFade = a.renderHidden || b.renderHidden ? 0.28 : 1
    const alpha = hiddenFade * edge.alpha * band.edgeOpacity * Math.max(0.24, 0.82 - Math.max(a.depth, b.depth) * 0.16)
    g.beginPath()
    g.moveTo(a.sx, a.sy)
    g.lineTo(b.sx, b.sy)
    g.strokeStyle = `rgba(${rgb255(color, 0.62)},${alpha})`
    g.lineWidth = edge.width
    g.stroke()
  }
}

function drawNode (g: CanvasRenderingContext2D, node: ProjectedNode, seed: number, band: ZoomBand): void {
  if (node.renderMode !== 'full') return
  const r = Math.max(0.55, node.vr)
  if (r < 0.7) return
  const color = cloudColor(node.group, node.id, seed)
  const depth = Math.max(0.82, Math.min(1.12, 0.98 + node.depth * 0.09))
  const ring = ringThickness(r)
  const fillR = Math.max(0.34, r - ring)
  drawRing(g, node, r, (r < 1.5 ? band.tinyRingAlpha : band.ringAlpha) * node.renderAlpha)
  g.beginPath()
  g.arc(node.sx, node.sy, fillR, 0, Math.PI * 2)
  g.fillStyle = nodePaint(color, depth, node.renderAlpha)
  g.fill()
}

function drawTextureNode (g: CanvasRenderingContext2D, node: ProjectedNode, seed: number): void {
  if (node.renderMode !== 'texture') return
  const r = Math.max(0.22, Math.min(0.58, node.vr * 0.13))
  const color = cloudColor(node.group, node.id, seed)
  g.beginPath()
  g.arc(node.sx, node.sy, r, 0, Math.PI * 2)
  g.fillStyle = `rgba(${rgb255(color, 0.58 + node.depth * 0.08)},${node.renderAlpha * 0.52})`
  g.fill()
}

function drawRing (g: CanvasRenderingContext2D, n: ProjectedNode, r: number, alpha: number): void {
  g.beginPath()
  g.arc(n.sx, n.sy, r, 0, Math.PI * 2)
  g.fillStyle = `rgba(0,0,0,${alpha})`
  g.fill()
}

function nodePaint (color: readonly [number, number, number], depth: number, alpha: number): string {
  return `rgba(${rgb255(color, depth * 1.04)},${0.98 * alpha})`
}

function exposeDebug (metrics: Record<string, number>, nodes: ProjectedNode[], view: CloudView, band: ZoomBand, collision: CollisionMetrics, declutter: DeclutterMetrics, frameTime: number): void {
  const depths = nodes.map((n) => n.depth)
  const radii = nodes.map((n) => n.vr)
  const box = screenBox(nodes)
  const renderedNodes = nodes.filter((n) => n.renderMode === 'full' && n.vr >= 0.7).length
  ;(window as unknown as { __referenceCloudDebug?: unknown }).__referenceCloudDebug = {
    ...metrics,
    zoomBand: band.id,
    renderedNodeCount: renderedNodes,
    candidateNodeCount: nodes.length,
    acceptedFullGlyphCount: declutter.acceptedFullGlyphCount,
    fullNodeOverlapCount: countFullNodeOverlaps(nodes),
    rejectedNodeCount: declutter.rejectedNodeCount,
    rejectedDueToOcclusionCount: declutter.rejectedDueToOcclusionCount,
    rejectedTextureRenderCount: declutter.rejectedTextureRenderCount,
    densityNodeCount: declutter.densityNodeCount,
    rejectedFullGlyphRenderCount: 0,
    textureLayerEnabled: declutter.rejectedTextureRenderCount > 0,
    layoutMutationDuringRender: false,
    occupancyGridCellSize: declutter.occupancyGridCellSize,
    occupiedCellPercent: declutter.occupiedCellPercent,
    tileBudgetHitCount: declutter.tileBudgetHitCount,
    declutterTimeMs: declutter.declutterTimeMs,
    frameTimeMs: frameTime,
    graphScreenWidthPercent: (box.maxX - box.minX) / view.width,
    graphScreenHeightPercent: (box.maxY - box.minY) / view.height,
    clippedNodePercent: nodes.filter((n) => n.sx + n.pr < 0 || n.sx - n.pr > view.width || n.sy + n.pr < 0 || n.sy - n.pr > view.height).length / nodes.length,
    cameraScale: view.scale,
    medianOverlapRatio: collision.medianOverlapRatio,
    severeOverlapPercent: collision.severeOverlapPercent,
    collisionMovedPercent: collision.collisionMovedPercent,
    collisionCandidateCount: collision.collisionCandidateCount,
    collisionPairsChecked: collision.collisionPairsChecked,
    collisionIterations: collision.collisionIterations,
    collisionTimeMs: collision.collisionTimeMs,
    globalCollisionTriggered: false,
    zoomRelayoutTriggered: collision.zoomRelayoutTriggered,
    densityThinnedNodeCount: 0,
    densityHiddenNodeCount: 0,
    maxScreenBinCoverage: 0,
    percentBinsOverCoverageThreshold: 0,
    zMin: Math.min(...depths),
    zMax: Math.max(...depths),
    zStd: std(depths),
    radiusP50: quantile(radii, 0.5),
    radiusP75: quantile(radii, 0.75),
    radiusP90: quantile(radii, 0.9),
    radiusP99: quantile(radii, 0.99),
    radiusMax: Math.max(...radii),
    percentNodesUnder2px: radii.filter((r) => r < 2).length / radii.length,
    percentNodesOver8px: radii.filter((r) => r > 8).length / radii.length,
    percentNodesOver12px: radii.filter((r) => r > 12).length / radii.length,
  }
}

function screenBox (nodes: ProjectedNode[]): { minX: number; maxX: number; minY: number; maxY: number } {
  const box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  for (const node of nodes) {
    box.minX = Math.min(box.minX, node.sx - node.pr)
    box.maxX = Math.max(box.maxX, node.sx + node.pr)
    box.minY = Math.min(box.minY, node.sy - node.pr)
    box.maxY = Math.max(box.maxY, node.sy + node.pr)
  }
  return box
}

function std (values: number[]): number {
  const mean = values.reduce((sum, v) => sum + v, 0) / Math.max(1, values.length)
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / Math.max(1, values.length)
  return Math.sqrt(variance)
}

function quantile (values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0
}
