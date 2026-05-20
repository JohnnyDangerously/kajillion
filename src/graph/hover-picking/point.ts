import type { GraphConfigInterface } from '@/graph/config'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Store } from '@/graph/modules/Store'
import type { WebGpuPointPickerGrid } from '../runtime-contracts'
import { clearHoveredPoint, emptyHoverChange, setHoveredPoint } from './state'
import type { HoverChange, TransformLike } from './types'

export interface CpuPointHoverInput {
  config: GraphConfigInterface;
  graph: GraphData;
  grid: WebGpuPointPickerGrid | undefined;
  positions: Float32Array | undefined;
  store: Store;
  transform: TransformLike;
}

export function findHoveredPointOnCpu (input: CpuPointHoverInput): HoverChange {
  const { config, graph, grid, positions, store, transform } = input
  if (!positions || !grid) return emptyHoverChange()

  const mouseX = store.mousePosition[0] ?? NaN
  const mouseY = store.mousePosition[1] ?? NaN
  if (!Number.isFinite(mouseX) || !Number.isFinite(mouseY)) return emptyHoverChange()

  const screenMouseX = store.screenMousePosition[0] ?? 0
  const screenMouseY = store.screenSize[1] - (store.screenMousePosition[1] ?? store.screenSize[1])
  const k = Math.max(0.001, transform.k)
  const maxScreenRadius = Math.max(8, store.maxPointSize + 6)
  const radiusSpace = Math.max(grid.cellSize, (maxScreenRadius / k) * 1.5)
  const minCx = Math.max(0, Math.floor((mouseX - radiusSpace) / grid.cellSize))
  const maxCx = Math.min(grid.columns - 1, Math.floor((mouseX + radiusSpace) / grid.cellSize))
  const minCy = Math.max(0, Math.floor((mouseY - radiusSpace) / grid.cellSize))
  const maxCy = Math.min(grid.rows - 1, Math.floor((mouseY + radiusSpace) / grid.cellSize))
  const sizes = graph.pointSizes
  const imageSizes = graph.pointImageSizes
  const screenWidth = store.screenSize[0] ?? 0
  const screenHeight = store.screenSize[1] ?? 0
  const spaceSize = store.adjustedSpaceSize
  const offsetX = (screenWidth - spaceSize) / 2
  const offsetY = (screenHeight - spaceSize) / 2
  let bestIndex = -1
  let bestDistanceSq = Infinity
  let bestX = 0
  let bestY = 0

  for (let cy = minCy; cy <= maxCy; cy += 1) {
    for (let cx = minCx; cx <= maxCx; cx += 1) {
      const bucket = grid.buckets[cy * grid.columns + cx]
      if (!bucket) continue
      for (let bucketIndex = 0; bucketIndex < bucket.length; bucketIndex += 1) {
        const index = bucket[bucketIndex] ?? -1
        if (index < 0) continue
        const px = positions[index * 2]
        const py = positions[index * 2 + 1]
        if (px === undefined || py === undefined) continue
        const sx = transform.x + (offsetX + px) * k
        const sy = transform.y + (offsetY + spaceSize - py) * k
        const dx = sx - screenMouseX
        const dy = sy - screenMouseY
        const distanceSq = dx * dx + dy * dy
        const pointSize = Math.max(sizes?.[index] ?? config.pointDefaultSize, imageSizes?.[index] ?? 0) * config.pointSizeScale
        const scaledSize = config.scalePointsOnZoom ? pointSize * k : pointSize
        const hitRadius = Math.min(scaledSize, store.maxPointSize) / 2 + 4
        if (distanceSq <= hitRadius * hitRadius && distanceSq < bestDistanceSq) {
          bestIndex = index
          bestDistanceSq = distanceSq
          bestX = px
          bestY = py
        }
      }
    }
  }

  if (bestIndex >= 0) return setHoveredPoint(store, bestIndex, bestX, bestY)
  return clearHoveredPoint(store)
}
