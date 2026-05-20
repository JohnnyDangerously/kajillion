import type { Buffer, Device, RenderPass, Texture, UniformStore } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import type { GraphConfigInterface } from '@/graph/config'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Store } from '@/graph/modules/Store'
import type { PointDrawBindingCache } from '@/graph/modules/Points/passes/draw/bindings'
import type {
  DrawHighlightedUniforms,
  PointDrawFragmentUniforms,
  PointDrawUniforms,
  PointDrawVertexUniforms,
} from '@/graph/modules/Points/passes/draw/contracts'
import {
  fillPointDrawUniforms,
  getPointDrawBackend,
  hasPointDrawHighlighting,
  setPointDrawLayerFlags,
} from '@/graph/modules/Points/passes/draw/lifecycle'
import { drawMainPointsDirect } from '@/graph/modules/Points/passes/draw/direct'
import { drawPointRings } from '@/graph/modules/Points/passes/draw/rings'

export type { PointDrawBindingCache } from '@/graph/modules/Points/passes/draw/bindings'

export type DrawPointRenderPassOptions = {
  renderPass: RenderPass;
  usePreparedCulledDraw: boolean;
  device: Device;
  data: GraphData;
  config: GraphConfigInterface;
  store: Store;
  drawCommand: Model;
  drawUniformStore: UniformStore<PointDrawUniforms>;
  drawUniformPayload: PointDrawUniforms;
  drawVertexUniforms: PointDrawVertexUniforms;
  drawFragmentUniforms: PointDrawFragmentUniforms;
  drawHighlightedCommand: Model | undefined;
  drawHighlightedUniformStore: UniformStore<DrawHighlightedUniforms> | undefined;
  drawHighlightedUniformPayload: DrawHighlightedUniforms;
  currentPositionTexture: Texture;
  positionStorageBuffer: Buffer | undefined;
  previousRenderPositionStorageBuffer: Buffer | undefined;
  pointStatusTexture: Texture;
  pointStatusStorageBuffer: Buffer | undefined;
  imageAtlasTexture: Texture;
  imageAtlasCoordsTexture: Texture;
  imageCount: number;
  imageAtlasCoordsTextureSize: number | undefined;
  pointLodStrength: number;
  renderPositionMix: number;
  effectivePixelRatio: number;
  hasNonCircleShapes: boolean;
  isCulledPointDrawPrepared: boolean;
  drawBindings: PointDrawBindingCache;
  drawCulledPointsIndirect: (renderPass: RenderPass) => boolean;
}

export function drawPointRenderPass (
  options: DrawPointRenderPassOptions
): PointDrawBindingCache {
  const {
    renderPass,
    usePreparedCulledDraw,
    device,
    data,
    config,
    store,
    drawCommand,
    drawUniformStore,
    drawUniformPayload,
    drawVertexUniforms,
    drawFragmentUniforms,
    drawHighlightedCommand,
    drawHighlightedUniformStore,
    drawHighlightedUniformPayload,
    currentPositionTexture,
    positionStorageBuffer,
    previousRenderPositionStorageBuffer,
    pointStatusTexture,
    pointStatusStorageBuffer,
    imageAtlasTexture,
    imageAtlasCoordsTexture,
    imageCount,
    imageAtlasCoordsTextureSize,
    pointLodStrength,
    renderPositionMix,
    effectivePixelRatio,
    hasNonCircleShapes,
    isCulledPointDrawPrepared,
    drawBindings,
    drawCulledPointsIndirect,
  } = options

  const backend = getPointDrawBackend(device.info?.type)
  const pointCount = data.pointsNumber
  if (!pointCount) return drawBindings
  if (backend === 'webgpu') {
    if (!positionStorageBuffer || positionStorageBuffer.destroyed) return drawBindings
    if (!previousRenderPositionStorageBuffer || previousRenderPositionStorageBuffer.destroyed) return drawBindings
    if (!pointStatusStorageBuffer || pointStatusStorageBuffer.destroyed) return drawBindings
    drawCommand.setInstanceCount(pointCount)
  } else {
    drawCommand.setVertexCount(pointCount)
  }

  fillPointDrawUniforms(
    drawVertexUniforms,
    drawFragmentUniforms,
    config,
    store,
    effectivePixelRatio,
    imageCount,
    imageAtlasCoordsTextureSize,
    pointLodStrength,
    renderPositionMix,
    backend,
    hasNonCircleShapes
  )

  const hasHighlighting = hasPointDrawHighlighting(config)
  let drewMainPointsWithCulling = false
  if (usePreparedCulledDraw && isCulledPointDrawPrepared) {
    if (hasHighlighting) {
      setPointDrawLayerFlags(drawVertexUniforms, 'greyed')
      drawUniformStore.setUniforms(drawUniformPayload)
      drewMainPointsWithCulling = drawCulledPointsIndirect(renderPass)
      setPointDrawLayerFlags(drawVertexUniforms, 'highlighted')
      drawUniformStore.setUniforms(drawUniformPayload)
      drewMainPointsWithCulling = drawCulledPointsIndirect(renderPass) && drewMainPointsWithCulling
    } else {
      setPointDrawLayerFlags(drawVertexUniforms, 'all')
      drawUniformStore.setUniforms(drawUniformPayload)
      drewMainPointsWithCulling = drawCulledPointsIndirect(renderPass)
    }
  }

  let updatedDrawBindings = drawBindings
  if (!drewMainPointsWithCulling) {
    updatedDrawBindings = drawMainPointsDirect({
      renderPass,
      backend,
      drawCommand,
      drawUniformStore,
      drawUniformPayload,
      drawVertexUniforms,
      currentPositionTexture,
      positionStorageBuffer,
      previousRenderPositionStorageBuffer,
      pointStatusTexture,
      pointStatusStorageBuffer,
      imageAtlasTexture,
      imageAtlasCoordsTexture,
      hasHighlighting,
      drawBindings,
    })
  }

  drawPointRings({
    renderPass,
    data,
    config,
    store,
    drawHighlightedCommand,
    drawHighlightedUniformStore,
    drawHighlightedUniformPayload,
    currentPositionTexture,
    pointStatusTexture,
  })

  return updatedDrawBindings
}
