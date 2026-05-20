import type { GraphData } from '@/graph/modules/GraphData'
import type { Points } from '@/graph/modules/Points'

export interface GraphRuntimeQueryOwner {
  _isDestroyed: boolean
  graph: GraphData
  points: Points | undefined
  ensureDevice: (callback: () => void) => boolean
  trackPointPositionsByIndices: (indices: number[]) => void
}

export function getRuntimeQueryOwner (runtime: unknown): GraphRuntimeQueryOwner {
  return runtime as GraphRuntimeQueryOwner
}

export function getRuntimeNeighboringPointIndices (runtime: unknown, pointIndices: number | number[]): number[] {
  const owner = getRuntimeQueryOwner(runtime)
  if (owner._isDestroyed) return []
  return owner.graph.getNeighboringPointIndices(pointIndices)
}

export function getRuntimeConnectedLinkIndices (runtime: unknown, pointIndices: number | number[]): number[] {
  const owner = getRuntimeQueryOwner(runtime)
  if (owner._isDestroyed) return []
  return owner.graph.getConnectedLinkIndices(pointIndices)
}

export function getRuntimeConnectedPointIndices (runtime: unknown, linkIndices: number | number[]): number[] {
  const owner = getRuntimeQueryOwner(runtime)
  if (owner._isDestroyed) return []
  return owner.graph.getConnectedPointIndices(linkIndices)
}

export function trackRuntimePointPositionsByIndices (runtime: unknown, indices: number[]): void {
  const owner = getRuntimeQueryOwner(runtime)
  if (owner._isDestroyed) return

  if (owner.ensureDevice(() => owner.trackPointPositionsByIndices(indices))) return
  if (!owner.points) return
  owner.points.trackPointsByIndices(indices)
}
