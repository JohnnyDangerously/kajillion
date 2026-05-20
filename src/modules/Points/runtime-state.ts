import type {
  PointDrawFragmentUniforms,
  PointDrawVertexUniforms,
} from '@/graph/modules/Points/passes/draw/contracts'
import {
  createDrawHighlightedUniformPayload,
  createPointDrawFragmentUniformScratch,
  createPointDrawVertexUniformScratch,
} from '@/graph/modules/Points/passes/draw/lifecycle'

type PointsRuntime = any

function runtime (points: unknown): PointsRuntime {
  return points as PointsRuntime
}

export function initializePointRuntimeState (points: unknown): void {
  const p = runtime(points)
  p.renderPositionMix = 1
  p.isPositionStorageBufferDirty = true
  p.imageCount = 0
  p.hasNonCircleShapes = false
  p.areClusterCentroidsUpToDate = false
  p.isPositionsUpToDate = false
  p.hybridAnchorCapacity = 0
  p.tileColumns = 0
  p.tileRows = 0
  p.tileCount = 0
  p.impostorBuildSignature = ''
  p.positionStorageBufferTextureSize = 0
  p.visiblePointTileBudgetCapacity = 0
  p.activePointMaskCapacity = 0
  p.activePointMaskSignature = ''
  p.activePointMaskPointCount = 0
  p.activePointMaskDirty = true
  p.visiblePointCapacity = 0
  p.visiblePointGroupCapacity = 0
  p.visiblePointBlockCapacity = 0
  p.isCulledPointDrawPrepared = false
  p.polygonPathLength = 0

  const drawVertexUniformScratch: PointDrawVertexUniforms = createPointDrawVertexUniformScratch()
  const drawFragmentUniformScratch: PointDrawFragmentUniforms = createPointDrawFragmentUniformScratch()
  p.drawVertexUniformScratch = drawVertexUniformScratch
  p.drawFragmentUniformScratch = drawFragmentUniformScratch
  p.drawUniformPayload = {
    drawVertexUniforms: drawVertexUniformScratch,
    drawFragmentUniforms: drawFragmentUniformScratch,
  }
  p.drawHighlightedUniformPayload = createDrawHighlightedUniformPayload()
}

export function markPointRuntimeActiveMaskDirty (points: unknown): void {
  runtime(points).activePointMaskDirty = true
}
