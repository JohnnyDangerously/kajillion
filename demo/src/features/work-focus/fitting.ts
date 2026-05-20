import { pointPositionsForIndices } from '../ui-state/graph-interactions'
import type { WorkFocusControllerOptions } from './contracts'

export function createFitPointIndices (options: WorkFocusControllerOptions) {
  return (indices: number[], duration: number, padding: number): void => {
    const graph = options.getCurrentGraph()
    const data = options.getCurrentRenderData() ?? options.getCurrentData()
    if (!graph || !data) return
    const isOverviewFit = indices.length === 0
    const positions = pointPositionsForIndices(data, indices)
    if (!positions) return
    const cfg = options.getCurrentConfig()
    graph.setZoomTransformByPointPositions(
      positions,
      duration,
      isOverviewFit && cfg.palette === 'analyst' && cfg.theme === 'light'
        ? graph.zoomDistanceToLevel(100)
        : undefined,
      padding,
      false
    )
  }
}
