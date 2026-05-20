import {
  runDragPointRender,
  runUpdatePositionRender,
} from '@/graph/modules/Points/passes/position-compute/render'
import {
  capturePreviousPositionBuffer,
  readbackPointPositionBuffer,
} from '@/graph/modules/Points/passes/positions/readback'
import {
  dragCompute,
  syncPositionStorageBufferCompute,
  updatePositionCompute,
} from './runtime-position-compute'
export {
  dragCompute,
  initDragPointComputePipeline,
  initSyncPositionPipeline,
  initUpdatePositionComputePipeline,
  syncPositionStorageBufferCompute,
  updatePositionCompute,
} from './runtime-position-compute'

type PointsRuntime = any

function runtime (points: unknown): PointsRuntime {
  return points as PointsRuntime
}

export function updatePosition (points: unknown): void {
  const p = runtime(points)
  if (p.device.info?.type === 'webgpu') {
    updatePositionCompute(p)
    return
  }
  if (runUpdatePositionRender({
    device: p.device,
    command: p.updatePositionCommand,
    uniformStore: p.updatePositionUniformStore,
    currentPositionFbo: p.currentPositionFbo,
    previousPositionTexture: p.previousPositionTexture,
    velocityTexture: p.velocityTexture,
    pinnedStatusTexture: p.pinnedStatusTexture,
    friction: p.config.simulationFriction,
    spaceSize: p.store.adjustedSpaceSize,
  })) {
    p.isPositionsUpToDate = false
    p.isPositionStorageBufferDirty = true
  }
}

export function dragPoint (points: unknown): void {
  const p = runtime(points)
  if (p.device.info?.type === 'webgpu') {
    dragCompute(p)
    return
  }
  if (runDragPointRender({
    device: p.device,
    command: p.dragPointCommand,
    uniformStore: p.dragPointUniformStore,
    currentPositionFbo: p.currentPositionFbo,
    previousPositionTexture: p.previousPositionTexture,
    mousePosition: p.store.mousePosition,
    hoveredPointIndex: p.store.hoveredPoint?.index ?? -1,
  })) {
    p.isPositionsUpToDate = false
    p.isPositionStorageBufferDirty = true
  }
}

export function syncPositionStorageBuffer (points: unknown, force = false): boolean {
  const p = runtime(points)
  if (!p.device || p.device.info?.type !== 'webgpu') return false
  if (!force && !p.isPositionStorageBufferDirty) return false
  if (!p.currentPositionTexture || p.currentPositionTexture.destroyed) return false
  if (!p.positionStorageBuffer || p.positionStorageBuffer.destroyed) return false
  const size = p.positionStorageBufferTextureSize
  if (size === 0) return false
  const pointCount = p.data.pointsNumber ?? 0
  if (pointCount === 0) return false
  const didSync = syncPositionStorageBufferCompute(p, pointCount, size)
  if (!didSync) return false
  p.isPositionStorageBufferDirty = false
  return true
}

export function setRenderPositionInterpolation (points: unknown, value: number): void {
  runtime(points).renderPositionMix = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1
}

export function captureRenderPreviousPositions (points: unknown): boolean {
  const p = runtime(points)
  return capturePreviousPositionBuffer({
    device: p.device,
    positionStorageBuffer: p.positionStorageBuffer,
    previousRenderPositionStorageBuffer: p.previousRenderPositionStorageBuffer,
  })
}

export function readbackPointPositions (points: unknown): Promise<Float32Array> {
  const p = runtime(points)
  return readbackPointPositionBuffer({
    device: p.device,
    positionStorageBuffer: p.positionStorageBuffer,
    textureSize: p.positionStorageBufferTextureSize,
    pointCount: p.data.pointsNumber ?? 0,
    isPositionStorageBufferDirty: p.isPositionStorageBufferDirty,
    syncPositionStorageBuffer: () => p.syncPositionStorageBuffer(),
  })
}

export function swapFbo (points: unknown): void {
  const p = runtime(points)
  if (!p.currentPositionTexture || p.currentPositionTexture.destroyed ||
      !p.previousPositionTexture || p.previousPositionTexture.destroyed ||
      !p.currentPositionFbo || p.currentPositionFbo.destroyed ||
      !p.previousPositionFbo || p.previousPositionFbo.destroyed) {
    return
  }
  const tempTexture = p.previousPositionTexture
  const tempFbo = p.previousPositionFbo
  p.previousPositionTexture = p.currentPositionTexture
  p.previousPositionFbo = p.currentPositionFbo
  p.currentPositionTexture = tempTexture
  p.currentPositionFbo = tempFbo
  p.areClusterCentroidsUpToDate = false
}
