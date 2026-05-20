import { ensureVec2 } from '@/graph/modules/Shared/uniform-utils'
import {
  DEFAULT_POINT_LOD_ZOOM_RANGE,
  ZERO_VEC2,
} from '@/graph/modules/Points/passes/shared/constants'
import type {
  PrepareVisiblePointCullOptions,
  PrepareVisiblePointCullResult,
  VisiblePointCullState,
} from '@/graph/modules/Points/passes/visible-culling/prepareTypes'
import {
  getVisiblePointTileBudgetLayout,
} from '@/graph/modules/Points/passes/visible-culling/config'
import {
  destroyVisiblePointBuffers,
  ensureVisiblePointBuffers,
  ensureVisiblePointTileBudgetBuffer,
} from '@/graph/modules/Points/passes/visible-culling/lifecycle'
import { createCullVisiblePointsUniformPayload } from '@/graph/modules/Points/passes/visible-culling/uniforms'
import { runVisiblePointCullComputePasses } from '@/graph/modules/Points/passes/visible-culling/compute'
import {
  canAttemptVisiblePointCull,
  hasRunnableVisiblePointCullState,
} from '@/graph/modules/Points/passes/visible-culling/prepareGuards'
import { ensureVisiblePointCullPipelineState } from '@/graph/modules/Points/passes/visible-culling/preparePipelines'
import {
  getEstimatedPointPixelSize,
  shouldPrepareCulledPointDraw,
} from '@/graph/modules/Points/passes/draw/lifecycle'

export type {
  PrepareVisiblePointCullOptions,
  PrepareVisiblePointCullResult,
  VisiblePointCullState,
} from '@/graph/modules/Points/passes/visible-culling/prepareTypes'

export function prepareVisiblePointCullDraw (
  options: PrepareVisiblePointCullOptions
): PrepareVisiblePointCullResult {
  let state: VisiblePointCullState = {
    ...options.state,
    isCulledPointDrawPrepared: false,
  }
  if (!canAttemptVisiblePointCull(options)) return { state, prepared: false }

  const sizeBuffer = options.sizeBuffer ?? options.ensureSizeBuffer()
  if (!sizeBuffer || sizeBuffer.destroyed) return { state, prepared: false }
  const pointCount = options.data.pointsNumber ?? 0
  const pointLodStrength = options.getEffectivePointLodStrength()
  const scale = Math.abs(options.store.transformationMatrix4x4[0] ?? 1)
  const tileBudgetLayout = getVisiblePointTileBudgetLayout({
    config: options.config,
    screenSize: ensureVec2(options.store.screenSize, ZERO_VEC2),
    pixelRatio: options.effectivePixelRatio,
    scale,
  })
  const pointLodRange = ensureVec2(options.config.pointLodZoomRange, DEFAULT_POINT_LOD_ZOOM_RANGE)
  const hasActiveFilter = options.config.activePointIndices !== undefined
  const pointTileBudgetActive = tileBudgetLayout.budget > 0

  if (!shouldPrepareCulledPointDraw(
    options.forcePolicy,
    hasActiveFilter,
    scale,
    pointLodStrength,
    pointLodRange,
    getEstimatedPointPixelSize(options.config, options.effectivePixelRatio, scale),
    options.config.pointMinPixelSize,
    pointTileBudgetActive
  )) return { state, prepared: false }

  state = {
    ...state,
    ...ensureVisiblePointBuffers(options.device, state, pointCount),
  }
  state = {
    ...state,
    ...ensureVisiblePointTileBudgetBuffer(options.device, state, tileBudgetLayout.capacity),
  }

  const activePointMaskBuffer = options.updateActivePointMask()
  state = ensureVisiblePointCullPipelineState({
    state,
    prepareOptions: options,
    pointCount,
    pointLodStrength,
    hasActiveFilter,
  })

  if (!hasRunnableVisiblePointCullState(state, activePointMaskBuffer, options)) {
    return { state, prepared: false }
  }
  const positionStorageBuffer = options.positionStorageBuffer
  const previousPositionStorageBuffer = options.previousRenderPositionStorageBuffer
  const pointStatusStorageBuffer = options.pointStatusStorageBuffer
  if (!positionStorageBuffer || !previousPositionStorageBuffer || !pointStatusStorageBuffer || !activePointMaskBuffer) {
    return { state, prepared: false }
  }

  state.cullVisiblePointsUniformStore.setUniforms(createCullVisiblePointsUniformPayload({
    config: options.config,
    store: options.store,
    effectivePixelRatio: options.effectivePixelRatio,
    pointCount,
    pointLodStrength,
    pointLodRange,
    renderPositionMix: options.renderPositionMix,
    hasActiveFilter,
    tileBudgetLayout,
  }))

  runVisiblePointCullComputePasses({
    device: options.device,
    cullVisiblePointsPipeline: state.cullVisiblePointsPipeline,
    clearVisiblePointTileBudgetPipeline: state.clearVisiblePointTileBudgetPipeline,
    selectVisiblePointTileBudgetPipeline: state.selectVisiblePointTileBudgetPipeline,
    prefixVisiblePointsPipeline: state.prefixVisiblePointsPipeline,
    prefixVisiblePointBlocksPipeline: state.prefixVisiblePointBlocksPipeline,
    addVisiblePointBlockOffsetsPipeline: state.addVisiblePointBlockOffsetsPipeline,
    scatterVisiblePointsPipeline: state.scatterVisiblePointsPipeline,
    cullUniforms: state.cullVisiblePointsUniformBuffer,
    positions: positionStorageBuffer,
    previousPositions: previousPositionStorageBuffer,
    sizes: sizeBuffer,
    activeMask: activePointMaskBuffer,
    pointStatusBuf: pointStatusStorageBuffer,
    visibleIndices: state.visiblePointIndexBuffer,
    visibleGroupOffsets: state.visiblePointGroupOffsetBuffer,
    visibleMask: state.visiblePointMaskBuffer,
    blockSums: state.visiblePointBlockSumBuffer,
    blockOffsets: state.visiblePointBlockOffsetBuffer,
    indirectArgs: state.visiblePointIndirectBuffer,
    tileBudgetPriorities: state.visiblePointTileBudgetBuffer,
    pointCount,
    visiblePointGroupCapacity: state.visiblePointGroupCapacity,
    visiblePointBlockCapacity: state.visiblePointBlockCapacity,
    tileBudgetLayout,
    timer: options.timer,
  })

  return {
    state: {
      ...state,
      isCulledPointDrawPrepared: true,
    },
    prepared: true,
  }
}

export function destroyVisiblePointCullState (state: VisiblePointCullState): VisiblePointCullState {
  const buffers = destroyVisiblePointBuffers({
    visiblePointIndexBuffer: state.visiblePointIndexBuffer,
    visiblePointIndirectBuffer: state.visiblePointIndirectBuffer,
    visiblePointGroupOffsetBuffer: state.visiblePointGroupOffsetBuffer,
    visiblePointMaskBuffer: state.visiblePointMaskBuffer,
    visiblePointBlockSumBuffer: state.visiblePointBlockSumBuffer,
    visiblePointBlockOffsetBuffer: state.visiblePointBlockOffsetBuffer,
  })
  return {
    ...state,
    ...buffers,
  }
}
