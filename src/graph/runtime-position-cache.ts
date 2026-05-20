import type { GraphConfigInterface } from '@/graph/config'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Points } from '@/graph/modules/Points'
import type { Store } from '@/graph/modules/Store'
import { buildWebGpuLinkPickerGrid, buildWebGpuPointPickerGrid } from '@/graph/graph/picker-grid'
import type { LinkHoverPathCache } from '@/graph/graph/hover-picking'
import { visitLinkHoverPathSegments } from '@/graph/graph/hover-picking'
import type { PointPositionReadbackCache } from '@/graph/graph/readback/point-position-readback-cache'
import type {
  WebGpuLinkPickerGrid,
  WebGpuPointPickerGrid,
} from '@/graph/graph/runtime-contracts'

export interface RuntimePositionCacheContext {
  config: GraphConfigInterface
  graph: GraphData
  store: Store
  pointPositions: PointPositionReadbackCache
  linkHoverPathCache: LinkHoverPathCache
  isDestroyed: () => boolean
  isWebGpu: () => boolean
  getPoints: () => Points | undefined
  setPointPickerGrid: (grid: WebGpuPointPickerGrid | undefined) => void
  setLinkPickerGrid: (grid: WebGpuLinkPickerGrid | undefined) => void
}

export function markRuntimePointPositionsChanged (
  context: RuntimePositionCacheContext,
  invalidateKnownPickerData = false,
): void {
  context.pointPositions.markChanged(invalidateKnownPickerData)
  if (invalidateKnownPickerData) {
    context.setPointPickerGrid(undefined)
    context.setLinkPickerGrid(undefined)
  }
}

export function markRuntimeLinksChanged (context: RuntimePositionCacheContext): void {
  context.setLinkPickerGrid(undefined)
}

export function onRuntimeWebGpuPointPositionsCached (
  context: RuntimePositionCacheContext,
  positions: Float32Array,
): void {
  rebuildRuntimeWebGpuPointPickerGrid(context, positions)
  context.setLinkPickerGrid(undefined)
}

export function requestRuntimeWebGpuPointPositionsSnapshot (
  context: RuntimePositionCacheContext,
  force = false,
): void {
  const points = context.getPoints()
  if (context.isDestroyed() || !context.isWebGpu() || !points) return
  context.pointPositions.requestSnapshot({
    force,
    readPositions: () => context.getPoints()?.readbackPointPositions() ?? Promise.resolve(new Float32Array(0)),
    isDestroyed: context.isDestroyed,
    onCache: (positions) => onRuntimeWebGpuPointPositionsCached(context, positions),
    onError: (error) => {
      console.warn('[kajillion] WebGPU point-position snapshot failed', error)
    },
  })
}

export function rebuildRuntimeWebGpuPointPickerGrid (
  context: RuntimePositionCacheContext,
  positions: Float32Array,
): void {
  const n = context.graph.pointsNumber ?? 0
  const spaceSize = context.store.adjustedSpaceSize || context.config.spaceSize || 4096
  context.setPointPickerGrid(buildWebGpuPointPickerGrid(positions, n, spaceSize))
}

export function rebuildRuntimeWebGpuLinkPickerGrid (
  context: RuntimePositionCacheContext,
  positions: Float32Array,
): void {
  const linksNumber = context.graph.linksNumber ?? 0
  const pointsNumber = context.graph.pointsNumber ?? 0
  const spaceSize = context.store.adjustedSpaceSize || context.config.spaceSize || 4096
  context.setLinkPickerGrid(buildWebGpuLinkPickerGrid(
    positions,
    context.graph.links,
    linksNumber,
    pointsNumber,
    spaceSize,
    (sx, sy, tx, ty, linkIndex, visitor) => {
      visitLinkHoverPathSegments(context.config, context.linkHoverPathCache, sx, sy, tx, ty, linkIndex, visitor)
    }
  ))
}

export function getBestKnownRuntimeWebGpuPointPositions (
  context: RuntimePositionCacheContext,
): Float32Array | undefined {
  if (context.pointPositions.isStale) {
    requestRuntimeWebGpuPointPositionsSnapshot(context)
  }
  return context.pointPositions.cachedPositions ?? context.graph.inputPointPositions
}
