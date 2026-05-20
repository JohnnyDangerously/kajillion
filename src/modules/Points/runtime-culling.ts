import type { GpuTimerLike } from '@/graph/modules/Points/passes/shared/contracts'
import { prepareVisiblePointCullDraw } from '@/graph/modules/Points/passes/visible-culling/prepare'
import type { VisiblePointCullState } from '@/graph/modules/Points/passes/visible-culling/prepareTypes'
import {
  updateActivePointMask as updateActivePointMaskState,
} from '@/graph/modules/Points/passes/visible-culling/activeMask'

type PointsRuntime = any

function runtime (points: unknown): PointsRuntime {
  return points as PointsRuntime
}

export function setVisiblePointCullState (points: unknown, state: VisiblePointCullState): void {
  const p = runtime(points)
  p.visiblePointIndexBuffer = state.visiblePointIndexBuffer
  p.visiblePointIndirectBuffer = state.visiblePointIndirectBuffer
  p.visiblePointGroupOffsetBuffer = state.visiblePointGroupOffsetBuffer
  p.visiblePointMaskBuffer = state.visiblePointMaskBuffer
  p.visiblePointBlockSumBuffer = state.visiblePointBlockSumBuffer
  p.visiblePointBlockOffsetBuffer = state.visiblePointBlockOffsetBuffer
  p.visiblePointTileBudgetBuffer = state.visiblePointTileBudgetBuffer
  p.visiblePointCapacity = state.visiblePointCapacity
  p.visiblePointGroupCapacity = state.visiblePointGroupCapacity
  p.visiblePointBlockCapacity = state.visiblePointBlockCapacity
  p.visiblePointTileBudgetCapacity = state.visiblePointTileBudgetCapacity
  p.cullVisiblePointsUniformStore = state.cullVisiblePointsUniformStore
  p.cullVisiblePointsUniformBuffer = state.cullVisiblePointsUniformBuffer
  p.cullVisiblePointsPipeline = state.cullVisiblePointsPipeline
  p.prefixVisiblePointsPipeline = state.prefixVisiblePointsPipeline
  p.prefixVisiblePointBlocksPipeline = state.prefixVisiblePointBlocksPipeline
  p.addVisiblePointBlockOffsetsPipeline = state.addVisiblePointBlockOffsetsPipeline
  p.clearVisiblePointTileBudgetPipeline = state.clearVisiblePointTileBudgetPipeline
  p.selectVisiblePointTileBudgetPipeline = state.selectVisiblePointTileBudgetPipeline
  p.scatterVisiblePointsPipeline = state.scatterVisiblePointsPipeline
  p.cullVisiblePointsShader = state.cullVisiblePointsShader
  p.prefixVisiblePointsShader = state.prefixVisiblePointsShader
  p.clearVisiblePointTileBudgetShader = state.clearVisiblePointTileBudgetShader
  p.isCulledPointDrawPrepared = state.isCulledPointDrawPrepared
}

export function prepareGpuCulledPointDraw (points: unknown, timer?: GpuTimerLike, forcePolicy = false): boolean {
  const p = runtime(points)
  const result = prepareVisiblePointCullDraw({
    device: p.device,
    data: p.data,
    config: p.config,
    store: p.store,
    state: {
      visiblePointIndexBuffer: p.visiblePointIndexBuffer,
      visiblePointIndirectBuffer: p.visiblePointIndirectBuffer,
      visiblePointGroupOffsetBuffer: p.visiblePointGroupOffsetBuffer,
      visiblePointMaskBuffer: p.visiblePointMaskBuffer,
      visiblePointBlockSumBuffer: p.visiblePointBlockSumBuffer,
      visiblePointBlockOffsetBuffer: p.visiblePointBlockOffsetBuffer,
      visiblePointTileBudgetBuffer: p.visiblePointTileBudgetBuffer,
      visiblePointCapacity: p.visiblePointCapacity,
      visiblePointGroupCapacity: p.visiblePointGroupCapacity,
      visiblePointBlockCapacity: p.visiblePointBlockCapacity,
      visiblePointTileBudgetCapacity: p.visiblePointTileBudgetCapacity,
      cullVisiblePointsUniformStore: p.cullVisiblePointsUniformStore,
      cullVisiblePointsUniformBuffer: p.cullVisiblePointsUniformBuffer,
      cullVisiblePointsPipeline: p.cullVisiblePointsPipeline,
      prefixVisiblePointsPipeline: p.prefixVisiblePointsPipeline,
      prefixVisiblePointBlocksPipeline: p.prefixVisiblePointBlocksPipeline,
      addVisiblePointBlockOffsetsPipeline: p.addVisiblePointBlockOffsetsPipeline,
      clearVisiblePointTileBudgetPipeline: p.clearVisiblePointTileBudgetPipeline,
      selectVisiblePointTileBudgetPipeline: p.selectVisiblePointTileBudgetPipeline,
      scatterVisiblePointsPipeline: p.scatterVisiblePointsPipeline,
      cullVisiblePointsShader: p.cullVisiblePointsShader,
      prefixVisiblePointsShader: p.prefixVisiblePointsShader,
      clearVisiblePointTileBudgetShader: p.clearVisiblePointTileBudgetShader,
      isCulledPointDrawPrepared: p.isCulledPointDrawPrepared,
    },
    forcePolicy,
    timer,
    effectivePixelRatio: p.effectivePixelRatio,
    renderPositionMix: p.renderPositionMix,
    imageCount: p.imageCount,
    hasNonCircleShapes: p.hasNonCircleShapes,
    positionStorageBuffer: p.positionStorageBuffer,
    previousRenderPositionStorageBuffer: p.previousRenderPositionStorageBuffer,
    sizeBuffer: p.sizeBuffer,
    colorBuffer: p.colorBuffer,
    pointStatusStorageBuffer: p.pointStatusStorageBuffer,
    activePointMaskBuffer: p.activePointMaskBuffer,
    updateActivePointMask: () => {
      p.updateActivePointMask()
      return p.activePointMaskBuffer
    },
    ensureSizeBuffer: () => {
      if (!p.sizeBuffer) p.updateSize()
      return p.sizeBuffer
    },
    ensureColorBuffer: () => {
      if (!p.colorBuffer) p.updateColor()
      return p.colorBuffer
    },
    getEffectivePointLodStrength: () => p.getEffectivePointLodStrength(),
  })
  setVisiblePointCullState(p, result.state)
  return result.prepared
}

export function updateActivePointMask (points: unknown): void {
  const p = runtime(points)
  const pointCount = p.data.pointsNumber ?? 0
  if (p.device.info?.type !== 'webgpu' || pointCount === 0) return
  const state = updateActivePointMaskState(p.device, {
    buffer: p.activePointMaskBuffer,
    capacity: p.activePointMaskCapacity,
    signature: p.activePointMaskSignature,
    pointCount: p.activePointMaskPointCount,
    dirty: p.activePointMaskDirty,
    indicesRef: p.activePointMaskIndicesRef,
  }, {
    activePointIndices: p.config.activePointIndices,
    pointCount,
  })
  p.activePointMaskBuffer = state.buffer
  p.activePointMaskCapacity = state.capacity
  p.activePointMaskSignature = state.signature
  p.activePointMaskPointCount = state.pointCount
  p.activePointMaskIndicesRef = state.indicesRef
  p.activePointMaskDirty = state.dirty
}
