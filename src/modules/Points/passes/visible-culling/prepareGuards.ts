import type { Buffer, ComputePipeline, UniformStore } from '@luma.gl/core'
import type { CullVisiblePointsUniforms } from '@/graph/modules/Points/passes/visible-culling/contracts'
import type {
  PrepareVisiblePointCullOptions,
  VisiblePointCullState,
} from '@/graph/modules/Points/passes/visible-culling/prepareTypes'

export function canAttemptVisiblePointCull (options: PrepareVisiblePointCullOptions): boolean {
  if (options.device.info?.type !== 'webgpu') return false
  if (!options.data.pointsNumber) return false
  if (!options.store.screenSize || options.store.screenSize[0] === 0 || options.store.screenSize[1] === 0) return false
  if (!options.positionStorageBuffer || options.positionStorageBuffer.destroyed) return false
  if (!options.previousRenderPositionStorageBuffer || options.previousRenderPositionStorageBuffer.destroyed) return false
  const sizeBuffer = options.sizeBuffer ?? options.ensureSizeBuffer()
  if (!sizeBuffer || sizeBuffer.destroyed) return false
  const colorBuffer = options.colorBuffer ?? options.ensureColorBuffer()
  if (!colorBuffer || colorBuffer.destroyed) return false
  if (!options.pointStatusStorageBuffer || options.pointStatusStorageBuffer.destroyed) return false
  if (options.imageCount > 0 || options.hasNonCircleShapes) return false
  return true
}

export function hasRunnableVisiblePointCullState (
  state: VisiblePointCullState,
  activePointMaskBuffer: Buffer | undefined,
  options: PrepareVisiblePointCullOptions
): state is VisiblePointCullState & {
    visiblePointIndexBuffer: Buffer;
    visiblePointIndirectBuffer: Buffer;
    visiblePointGroupOffsetBuffer: Buffer;
    visiblePointMaskBuffer: Buffer;
    visiblePointBlockSumBuffer: Buffer;
    visiblePointBlockOffsetBuffer: Buffer;
    visiblePointTileBudgetBuffer: Buffer;
    cullVisiblePointsPipeline: ComputePipeline;
    clearVisiblePointTileBudgetPipeline: ComputePipeline;
    selectVisiblePointTileBudgetPipeline: ComputePipeline;
    prefixVisiblePointsPipeline: ComputePipeline;
    prefixVisiblePointBlocksPipeline: ComputePipeline;
    addVisiblePointBlockOffsetsPipeline: ComputePipeline;
    scatterVisiblePointsPipeline: ComputePipeline;
    cullVisiblePointsUniformStore: UniformStore<CullVisiblePointsUniforms>;
    cullVisiblePointsUniformBuffer: Buffer;
  } {
  return !!(
    state.visiblePointIndexBuffer &&
    state.visiblePointIndirectBuffer &&
    state.visiblePointGroupOffsetBuffer &&
    state.visiblePointMaskBuffer &&
    state.visiblePointBlockSumBuffer &&
    state.visiblePointBlockOffsetBuffer &&
    state.visiblePointTileBudgetBuffer &&
    activePointMaskBuffer &&
    state.cullVisiblePointsPipeline &&
    state.clearVisiblePointTileBudgetPipeline &&
    state.selectVisiblePointTileBudgetPipeline &&
    state.prefixVisiblePointsPipeline &&
    state.prefixVisiblePointBlocksPipeline &&
    state.addVisiblePointBlockOffsetsPipeline &&
    state.scatterVisiblePointsPipeline &&
    state.cullVisiblePointsUniformStore &&
    state.cullVisiblePointsUniformBuffer &&
    options.positionStorageBuffer &&
    options.previousRenderPositionStorageBuffer &&
    options.pointStatusStorageBuffer
  )
}
