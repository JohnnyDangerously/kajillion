import type { Graph, GpuTimingSnapshot } from '@kajillion/graph'

export type GpuStat = {
  avgMs?: number;
  lastMs?: number;
  sampleCount?: number;
  median?: number;
  min?: number;
  max?: number;
  samples?: number | unknown[];
}

export function median (xs: number[]): number {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

export function fmtMs (s?: GpuStat): string {
  const sampleCount = typeof s?.sampleCount === 'number'
    ? s.sampleCount
    : Array.isArray(s?.samples)
      ? s.samples.length
      : typeof s?.samples === 'number'
        ? s.samples
        : 0
  const ms = typeof s?.avgMs === 'number' ? s.avgMs : s?.median
  if (!s || sampleCount === 0 || typeof ms !== 'number') return '—'
  return `${ms.toFixed(2)} ms`
}

export function statMs (snap: GpuTimingSnapshot | null, key: string): number {
  const s = snap?.[key] as GpuStat | undefined
  const sampleCount = typeof s?.sampleCount === 'number'
    ? s.sampleCount
    : Array.isArray(s?.samples)
      ? s.samples.length
      : typeof s?.samples === 'number'
        ? s.samples
        : 0
  const ms = typeof s?.avgMs === 'number' ? s.avgMs : s?.median
  return sampleCount > 0 && typeof ms === 'number' ? ms : 0
}

export function estimateGpuFrameMs (snap: GpuTimingSnapshot | null, graph: Graph): number {
  if (!snap) return 0
  const canvasMs = statMs(snap, 'render.canvas')
  const pointPrepassMs =
    statMs(snap, 'render.points.cull') +
    statMs(snap, 'points.visible.tile-budget.clear') +
    statMs(snap, 'points.visible.tile-budget.select') +
    statMs(snap, 'points.visible.count') +
    statMs(snap, 'points.visible.prefix.groups') +
    statMs(snap, 'points.visible.prefix.blocks') +
    statMs(snap, 'points.visible.prefix.add') +
    statMs(snap, 'points.visible.scatter') +
    statMs(snap, 'impostor.tiles.clear') +
    statMs(snap, 'impostor.tiles.bin') +
    statMs(snap, 'impostor.tiles.resolve') +
    statMs(snap, 'impostor.anchors.clear') +
    statMs(snap, 'impostor.anchors.fill') +
    statMs(snap, 'impostor.anchors.materialize')
  const linePrepassMs = statMs(snap, 'lines.visible.clear') + statMs(snap, 'lines.visible.cull')
  const renderMs = (canvasMs > 0 ? canvasMs : statMs(snap, 'render.lines') + statMs(snap, 'render.points')) + pointPrepassMs + linePrepassMs
  if (!graph.isSimulationRunning) return renderMs
  const forceMs =
    statMs(snap, 'force.gravity') +
    statMs(snap, 'force.center') +
    statMs(snap, 'force.quadtree.build') +
    statMs(snap, 'force.repulsion') +
    statMs(snap, 'force.link.incoming') +
    statMs(snap, 'force.link.outgoing') +
    statMs(snap, 'force.cluster') +
    statMs(snap, 'force.mouse')
  return renderMs + forceMs
}
