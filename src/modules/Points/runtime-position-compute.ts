import { ensureVec2 } from '@/graph/modules/Shared/uniform-utils'
import {
  runDragPointCompute,
  runSyncPositionStorageCompute,
  runUpdatePositionCompute,
} from '@/graph/modules/Points/passes/position-compute/commands'
import {
  ensureDragPointComputePipeline,
  ensureSyncPositionPipeline,
  ensureUpdatePositionComputePipeline,
} from '@/graph/modules/Points/passes/position-compute/pipelines'

type PointsRuntime = any

function runtime (points: unknown): PointsRuntime {
  return points as PointsRuntime
}

export function syncPositionStorageBufferCompute (points: unknown, pointCount: number, textureSize: number): boolean {
  const p = runtime(points)
  initSyncPositionPipeline(p)
  return runSyncPositionStorageCompute({
    device: p.device,
    pipeline: p.syncPositionPipeline,
    uniformStore: p.syncPositionUniformStore,
    uniformBuffer: p.syncPositionUniformBuffer,
    currentPositionTexture: p.currentPositionTexture,
    positionStorageBuffer: p.positionStorageBuffer,
    pointCount,
    textureSize,
  })
}

export function initSyncPositionPipeline (points: unknown): void {
  const p = runtime(points)
  if (!p.device || p.device.info?.type !== 'webgpu') return
  const state = ensureSyncPositionPipeline(p.device, {
    pipeline: p.syncPositionPipeline,
    shader: p.syncPositionShader,
    uniformStore: p.syncPositionUniformStore,
    uniformBuffer: p.syncPositionUniformBuffer,
  })
  p.syncPositionPipeline = state.pipeline
  p.syncPositionShader = state.shader
  p.syncPositionUniformStore = state.uniformStore
  p.syncPositionUniformBuffer = state.uniformBuffer
}

export function initUpdatePositionComputePipeline (points: unknown): void {
  const p = runtime(points)
  if (!p.device || p.device.info?.type !== 'webgpu') return
  const state = ensureUpdatePositionComputePipeline(p.device, {
    pipeline: p.updatePositionComputePipeline,
    shader: p.updatePositionComputeShader,
    uniformStore: p.updatePositionComputeUniformStore,
    uniformBuffer: p.updatePositionComputeUniformBuffer,
  })
  p.updatePositionComputePipeline = state.pipeline
  p.updatePositionComputeShader = state.shader
  p.updatePositionComputeUniformStore = state.uniformStore
  p.updatePositionComputeUniformBuffer = state.uniformBuffer
}

export function initDragPointComputePipeline (points: unknown): void {
  const p = runtime(points)
  if (!p.device || p.device.info?.type !== 'webgpu') return
  const state = ensureDragPointComputePipeline(p.device, {
    pipeline: p.dragPointComputePipeline,
    shader: p.dragPointComputeShader,
    uniformStore: p.dragPointComputeUniformStore,
    uniformBuffer: p.dragPointComputeUniformBuffer,
  })
  p.dragPointComputePipeline = state.pipeline
  p.dragPointComputeShader = state.shader
  p.dragPointComputeUniformStore = state.uniformStore
  p.dragPointComputeUniformBuffer = state.uniformBuffer
}

export function updatePositionCompute (points: unknown): void {
  const p = runtime(points)
  const pointCount = p.data.pointsNumber ?? 0
  const textureSize = p.store.pointsTextureSize ?? 0
  if (runUpdatePositionCompute({
    device: p.device,
    pipeline: p.updatePositionComputePipeline,
    uniformStore: p.updatePositionComputeUniformStore,
    uniformBuffer: p.updatePositionComputeUniformBuffer,
    currentPositionTexture: p.currentPositionTexture,
    previousPositionTexture: p.previousPositionTexture,
    velocityTexture: p.velocityTexture,
    pinnedStatusTexture: p.pinnedStatusTexture,
    positionStorageBuffer: p.positionStorageBuffer,
    friction: p.config.simulationFriction,
    spaceSize: p.store.adjustedSpaceSize,
    pointCount,
    textureSize,
  })) {
    p.isPositionsUpToDate = false
    p.isPositionStorageBufferDirty = false
  }
}

export function dragCompute (points: unknown): void {
  const p = runtime(points)
  const pointCount = p.data.pointsNumber ?? 0
  const textureSize = p.store.pointsTextureSize ?? 0
  if (runDragPointCompute({
    device: p.device,
    pipeline: p.dragPointComputePipeline,
    uniformStore: p.dragPointComputeUniformStore,
    uniformBuffer: p.dragPointComputeUniformBuffer,
    currentPositionTexture: p.currentPositionTexture,
    previousPositionTexture: p.previousPositionTexture,
    positionStorageBuffer: p.positionStorageBuffer,
    mousePos: ensureVec2(p.store.mousePosition, [0, 0]),
    index: p.store.hoveredPoint?.index ?? -1,
    pointCount,
    textureSize,
  })) {
    p.isPositionsUpToDate = false
    p.isPositionStorageBufferDirty = false
  }
}
