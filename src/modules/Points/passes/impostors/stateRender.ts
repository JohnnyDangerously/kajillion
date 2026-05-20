import type { RenderPass } from '@luma.gl/core'
import type { GpuTimerLike } from '@/graph/modules/Points/passes/shared/contracts'
import {
  drawImpostorComposite as drawImpostorCompositeState,
  drawImpostorExactOverlay as drawImpostorExactOverlayState,
  renderImpostorDensity as renderImpostorDensityState,
} from '@/graph/modules/Points/passes/impostors/render'

type PointsHost = any

export function renderImpostorDensityPass (
  points: PointsHost,
  timer?: GpuTimerLike,
  positionEpoch = 0
): boolean {
  const result = renderImpostorDensityState({
    device: points.device,
    config: points.config,
    data: points.data,
    store: points.store,
    state: {
      colorBuffer: points.colorBuffer,
      sizeBuffer: points.sizeBuffer,
      tileAtomicBuffer: points.tileAtomicBuffer,
      tileResolvedBuffer: points.tileResolvedBuffer,
      tileColumns: points.tileColumns,
      tileRows: points.tileRows,
      tileCount: points.tileCount,
      impostorBuildSignature: points.impostorBuildSignature,
      hybridAnchorCountBuffer: points.hybridAnchorCountBuffer,
      hybridAnchorPositionBuffer: points.hybridAnchorPositionBuffer,
      hybridAnchorColorBuffer: points.hybridAnchorColorBuffer,
      hybridAnchorIndirectBuffer: points.hybridAnchorIndirectBuffer,
      hybridAnchorCapacity: points.hybridAnchorCapacity,
      tileBuildPipelines: {
        uniformStore: points.tileImpostorUniformStore,
        uniformBuffer: points.tileImpostorUniformBuffer,
        clearPipeline: points.clearTileImpostorPipeline,
        clearShader: points.clearTileImpostorShader,
        binPipeline: points.binTileImpostorPipeline,
        binShader: points.binTileImpostorShader,
        resolvePipeline: points.resolveTileImpostorPipeline,
        resolveShader: points.resolveTileImpostorShader,
      },
      hybridAnchorBuildPipelines: {
        uniformStore: points.hybridAnchorBuildUniformStore,
        uniformBuffer: points.hybridAnchorBuildUniformBuffer,
        clearPipeline: points.clearHybridAnchorPipeline,
        clearShader: points.clearHybridAnchorShader,
        fillPipeline: points.fillHybridAnchorPipeline,
        fillShader: points.fillHybridAnchorShader,
        materializePipeline: points.materializeHybridAnchorPipeline,
        materializeShader: points.materializeHybridAnchorShader,
      },
    },
    positionStorageBuffer: points.positionStorageBuffer,
    effectivePixelRatio: points.effectivePixelRatio,
    buildParameters: {
      tileSize: points.getTileImpostorSize(),
      tileBuildSampleRate: points.getTileBuildSampleRate(),
      tileBuildSampleWeight: points.getTileBuildSampleWeight(),
      hybridAnchorsPerTile: points.getHybridAnchorsPerTile(),
    },
    timer,
    positionEpoch,
    ensureColorBuffer: () => {
      if (!points.colorBuffer) points.updateColor()
      return points.colorBuffer
    },
    ensureSizeBuffer: () => {
      if (!points.sizeBuffer) points.updateSize()
      return points.sizeBuffer
    },
  })
  points.colorBuffer = result.state.colorBuffer
  points.sizeBuffer = result.state.sizeBuffer
  points.tileAtomicBuffer = result.state.tileAtomicBuffer
  points.tileResolvedBuffer = result.state.tileResolvedBuffer
  points.tileColumns = result.state.tileColumns
  points.tileRows = result.state.tileRows
  points.tileCount = result.state.tileCount
  points.impostorBuildSignature = result.state.impostorBuildSignature
  points.hybridAnchorCountBuffer = result.state.hybridAnchorCountBuffer
  points.hybridAnchorPositionBuffer = result.state.hybridAnchorPositionBuffer
  points.hybridAnchorColorBuffer = result.state.hybridAnchorColorBuffer
  points.hybridAnchorIndirectBuffer = result.state.hybridAnchorIndirectBuffer
  points.hybridAnchorCapacity = result.state.hybridAnchorCapacity
  points.tileImpostorUniformStore = result.state.tileBuildPipelines.uniformStore
  points.tileImpostorUniformBuffer = result.state.tileBuildPipelines.uniformBuffer
  points.clearTileImpostorPipeline = result.state.tileBuildPipelines.clearPipeline
  points.clearTileImpostorShader = result.state.tileBuildPipelines.clearShader
  points.binTileImpostorPipeline = result.state.tileBuildPipelines.binPipeline
  points.binTileImpostorShader = result.state.tileBuildPipelines.binShader
  points.resolveTileImpostorPipeline = result.state.tileBuildPipelines.resolvePipeline
  points.resolveTileImpostorShader = result.state.tileBuildPipelines.resolveShader
  points.hybridAnchorBuildUniformStore = result.state.hybridAnchorBuildPipelines.uniformStore
  points.hybridAnchorBuildUniformBuffer = result.state.hybridAnchorBuildPipelines.uniformBuffer
  points.clearHybridAnchorPipeline = result.state.hybridAnchorBuildPipelines.clearPipeline
  points.clearHybridAnchorShader = result.state.hybridAnchorBuildPipelines.clearShader
  points.fillHybridAnchorPipeline = result.state.hybridAnchorBuildPipelines.fillPipeline
  points.fillHybridAnchorShader = result.state.hybridAnchorBuildPipelines.fillShader
  points.materializeHybridAnchorPipeline = result.state.hybridAnchorBuildPipelines.materializePipeline
  points.materializeHybridAnchorShader = result.state.hybridAnchorBuildPipelines.materializeShader
  return result.rendered
}

export function drawImpostorCompositePass (points: PointsHost, renderPass: RenderPass): boolean {
  const result = drawImpostorCompositeState({
    device: points.device,
    config: points.config,
    store: points.store,
    state: {
      drawQuadVertexBuffer: points.drawQuadVertexBuffer,
      tileImpostorCommand: points.tileImpostorCommand,
      tileRenderUniformStore: points.tileRenderUniformStore,
    },
    tileResolvedBuffer: points.tileResolvedBuffer,
    tileColumns: points.tileColumns,
    tileRows: points.tileRows,
    tileCount: points.tileCount,
    tileSize: points.getTileImpostorSize(),
    tileImpostorMicroSplats: points.getTileImpostorMicroSplats(),
    effectivePixelRatio: points.effectivePixelRatio,
    renderPass,
  })
  points.drawQuadVertexBuffer = result.state.drawQuadVertexBuffer
  points.tileImpostorCommand = result.state.tileImpostorCommand
  points.tileRenderUniformStore = result.state.tileRenderUniformStore
  return result.drew
}

export function drawImpostorExactOverlayPass (points: PointsHost, renderPass: RenderPass): void {
  const result = drawImpostorExactOverlayState({
    device: points.device,
    config: points.config,
    data: points.data,
    store: points.store,
    state: {
      colorBuffer: points.colorBuffer,
      drawQuadVertexBuffer: points.drawQuadVertexBuffer,
      hybridAnchorCommand: points.hybridAnchorCommand,
      hybridAnchorUniformStore: points.hybridAnchorUniformStore,
      compactedAnchorCommand: points.compactedAnchorCommand,
      compactedAnchorUniformStore: points.compactedAnchorUniformStore,
    },
    positionStorageBuffer: points.positionStorageBuffer,
    tileResolvedBuffer: points.tileResolvedBuffer,
    tileColumns: points.tileColumns,
    tileRows: points.tileRows,
    tileCount: points.tileCount,
    tileSize: points.getTileImpostorSize(),
    hybridAnchorCountBuffer: points.hybridAnchorCountBuffer,
    hybridAnchorPositionBuffer: points.hybridAnchorPositionBuffer,
    hybridAnchorColorBuffer: points.hybridAnchorColorBuffer,
    hybridAnchorIndirectBuffer: points.hybridAnchorIndirectBuffer,
    hybridAnchorCapacity: points.hybridAnchorCapacity,
    effectivePixelRatio: points.effectivePixelRatio,
    renderPass,
    ensureColorBuffer: () => {
      if (!points.colorBuffer) points.updateColor()
      return points.colorBuffer
    },
  })
  points.colorBuffer = result.state.colorBuffer
  points.drawQuadVertexBuffer = result.state.drawQuadVertexBuffer
  points.hybridAnchorCommand = result.state.hybridAnchorCommand
  points.hybridAnchorUniformStore = result.state.hybridAnchorUniformStore
  points.compactedAnchorCommand = result.state.compactedAnchorCommand
  points.compactedAnchorUniformStore = result.state.compactedAnchorUniformStore
}
