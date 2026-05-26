import type { ProjectedNode } from './project'
import { collisionRadius, type ZoomBand } from './zoom-band'

export interface CollisionMetrics {
  medianOverlapRatio: number;
  severeOverlapPercent: number;
  collisionMovedPercent: number;
  collisionCandidateCount: number;
  collisionPairsChecked: number;
  collisionIterations: number;
  collisionTimeMs: number;
  globalCollisionTriggered: boolean;
  zoomRelayoutTriggered: boolean;
}

export interface CollisionPolicy {
  enabled: boolean;
  maxCandidates: number;
  iterations: number;
  cameraMoving: boolean;
}

export function relaxPriorityCollisions (nodes: ProjectedNode[], band: ZoomBand, policy: CollisionPolicy): CollisionMetrics {
  const started = performance.now()
  if (!policy.enabled || policy.maxCandidates <= 0 || policy.iterations <= 0) return metrics(nodes, 0, 0, 0, started, policy)
  const candidates = pickCandidates(nodes, policy.maxCandidates)
  const ax = new Float32Array(nodes.length)
  const ay = new Float32Array(nodes.length)
  for (let i = 0; i < nodes.length; i += 1) {
    ax[i] = nodes[i]!.sx
    ay[i] = nodes[i]!.sy
  }
  let pairs = 0
  for (let i = 0; i < policy.iterations; i += 1) {
    pairs += relaxOnce(nodes, candidates, band)
    pullToAnchors(nodes, ax, ay, i === 2 ? 0.18 : 0.08)
  }
  const moved = nodes.filter((n, i) => Math.hypot(n.sx - ax[i]!, n.sy - ay[i]!) > 0.4).length / nodes.length
  const ratios = sampleOverlapRatios(nodes)
  return {
    medianOverlapRatio: quantile(ratios, 0.5),
    severeOverlapPercent: ratios.filter((v) => v < 0.85).length / Math.max(1, ratios.length),
    collisionMovedPercent: moved,
    collisionCandidateCount: candidates.length,
    collisionPairsChecked: pairs,
    collisionIterations: policy.iterations,
    collisionTimeMs: performance.now() - started,
    globalCollisionTriggered: candidates.length >= nodes.length * 0.5,
    zoomRelayoutTriggered: policy.cameraMoving && policy.enabled,
  }
}

function relaxOnce (nodes: ProjectedNode[], candidates: number[], band: ZoomBand): number {
  const cell = Math.max(8, band.maxRadius * 2.2)
  const grid = new Map<string, number[]>()
  for (const i of candidates) add(grid, cellKey(nodes[i]!, cell), i)
  let pairs = 0
  for (const i of candidates) {
    const a = nodes[i]!
    const cx = Math.floor(a.sx / cell)
    const cy = Math.floor(a.sy / cell)
    for (let yy = cy - 1; yy <= cy + 1; yy += 1) {
      for (let xx = cx - 1; xx <= cx + 1; xx += 1) pairs += solveCell(nodes, grid.get(`${xx}:${yy}`), i, band)
    }
  }
  return pairs
}

function solveCell (nodes: ProjectedNode[], list: number[] | undefined, i: number, band: ZoomBand): number {
  if (!list) return 0
  const a = nodes[i]!
  let checked = 0
  for (const j of list) {
    if (j <= i) continue
    checked += 1
    const b = nodes[j]!
    const minD = band.collisionPadding * pairPadding(a, b) * (collisionRadius(a) + collisionRadius(b))
    const dx = a.sx - b.sx
    const dy = a.sy - b.sy
    const d = Math.max(0.01, Math.hypot(dx, dy))
    if (d >= minD) continue
    const overlap = (minD - d) * 0.44
    const pa = priority(a)
    const pb = priority(b)
    const ux = dx / d
    const uy = dy / d
    a.sx += ux * overlap * (pb / (pa + pb))
    a.sy += uy * overlap * (pb / (pa + pb))
    b.sx -= ux * overlap * (pa / (pa + pb))
    b.sy -= uy * overlap * (pa / (pa + pb))
  }
  return checked
}

function pairPadding (a: ProjectedNode, b: ProjectedNode): number {
  if (a.vr > 6 || b.vr > 6) return 1.18
  if (a.vr > 3 || b.vr > 3) return 1.06
  if (a.vr < 1.5 && b.vr < 1.5) return 0.82
  return 0.96
}

function pullToAnchors (nodes: ProjectedNode[], ax: Float32Array, ay: Float32Array, strength: number): void {
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]!
    const keep = Math.min(0.92, strength * (0.65 + priority(node) * 0.035))
    node.sx += (ax[i]! - node.sx) * keep
    node.sy += (ay[i]! - node.sy) * keep
  }
}

function priority (node: ProjectedNode): number {
  return 1 + node.importance * 8 + Math.min(6, node.vr * 0.45) + (node.bridge ? 1.5 : 0)
}

function pickCandidates (nodes: ProjectedNode[], maxCandidates: number): number[] {
  const candidates: number[] = []
  const seen = new Set<number>()
  const reserve = Math.floor(maxCandidates * 0.55)
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]!
    if (node.renderHidden || node.importance < 0.965) continue
    candidates.push(i)
    seen.add(i)
    if (candidates.length >= reserve) break
  }
  for (let i = 0; i < nodes.length && candidates.length < maxCandidates; i += 1) {
    const node = nodes[i]!
    if (seen.has(i) || node.renderHidden) continue
    if (node.vr <= 3.2 && !node.bridge) continue
    candidates.push(i)
  }
  return candidates
}

function sampleOverlapRatios (nodes: ProjectedNode[]): number[] {
  const ratios: number[] = []
  const step = Math.max(1, Math.floor(nodes.length / 90))
  for (let i = 0; i < nodes.length; i += step) {
    let best = Infinity
    for (let j = i + step; j < nodes.length; j += step) {
      const ratio = Math.hypot(nodes[i]!.sx - nodes[j]!.sx, nodes[i]!.sy - nodes[j]!.sy) / (collisionRadius(nodes[i]!) + collisionRadius(nodes[j]!))
      if (ratio < best) best = ratio
    }
    if (Number.isFinite(best)) ratios.push(best)
  }
  return ratios
}

function add (grid: Map<string, number[]>, key: string, value: number): void {
  const list = grid.get(key) ?? []
  list.push(value)
  grid.set(key, list)
}

function cellKey (node: ProjectedNode, cell: number): string {
  return `${Math.floor(node.sx / cell)}:${Math.floor(node.sy / cell)}`
}

function quantile (values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0
}

function metrics (
  nodes: ProjectedNode[],
  candidates: number,
  pairs: number,
  iterations: number,
  started: number,
  policy: CollisionPolicy,
): CollisionMetrics {
  const ratios = sampleOverlapRatios(nodes)
  return {
    medianOverlapRatio: quantile(ratios, 0.5),
    severeOverlapPercent: ratios.filter((v) => v < 0.85).length / Math.max(1, ratios.length),
    collisionMovedPercent: 0,
    collisionCandidateCount: candidates,
    collisionPairsChecked: pairs,
    collisionIterations: iterations,
    collisionTimeMs: performance.now() - started,
    globalCollisionTriggered: false,
    zoomRelayoutTriggered: policy.cameraMoving && policy.enabled,
  }
}
