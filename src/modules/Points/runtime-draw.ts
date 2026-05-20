import type { RenderPass } from '@luma.gl/core'
import {
  drawPointRenderPass,
  type PointDrawBindingCache,
} from '@/graph/modules/Points/passes/draw/render'
import {
  ensureDensityImpostorRenderCommands,
  ensureDensityImpostorTarget as ensureDensityImpostorTargetState,
} from '@/graph/modules/Points/passes/impostors/densityDraw'
import { createFullscreenQuadBuffer } from '@/graph/modules/Points/passes/resources/lifecycle'
import {
  drawCulledPointsIndirect as drawCulledPointsIndirectState,
} from '@/graph/modules/Points/passes/visible-culling/draw'

type PointsRuntime = any

function runtime (points: unknown): PointsRuntime {
  return points as PointsRuntime
}

function getDrawBindingCache (p: PointsRuntime): PointDrawBindingCache {
  return {
    backend: p.drawBindingsBackend,
    position: p.drawBindingsPosition,
    previousPosition: p.drawBindingsPreviousPosition,
    pointStatus: p.drawBindingsPointStatus,
    pointStatusBuffer: p.drawBindingsPointStatusBuffer,
    imageAtlas: p.drawBindingsImageAtlas,
    imageAtlasCoords: p.drawBindingsImageAtlasCoords,
  }
}

function setDrawBindingCache (p: PointsRuntime, drawBindings: PointDrawBindingCache): void {
  p.drawBindingsBackend = drawBindings.backend
  p.drawBindingsPosition = drawBindings.position
  p.drawBindingsPreviousPosition = drawBindings.previousPosition
  p.drawBindingsPointStatus = drawBindings.pointStatus
  p.drawBindingsPointStatusBuffer = drawBindings.pointStatusBuffer
  p.drawBindingsImageAtlas = drawBindings.imageAtlas
  p.drawBindingsImageAtlasCoords = drawBindings.imageAtlasCoords
}

export function drawPoints (points: unknown, renderPass: RenderPass, usePreparedCulledDraw = false): void {
  const p = runtime(points)
  const { data, config, store, device } = p
  if (!p.colorBuffer) p.updateColor()
  if (!p.sizeBuffer) p.updateSize()
  if (!p.shapeBuffer) p.updateShape()
  if (!p.imageIndicesBuffer) p.updateImageIndices()
  if (!p.imageSizesBuffer) p.updateImageSizes()

  const drawCommand = p.drawCommand
  const drawUniformStore = p.drawUniformStore
  const currentPositionTexture = p.currentPositionTexture
  const pointStatusTexture = p.pointStatusTexture
  if (!drawCommand || !drawUniformStore) return
  if (!currentPositionTexture || currentPositionTexture.destroyed) return
  if (!pointStatusTexture || pointStatusTexture.destroyed) return
  if (!p.imageAtlasTexture || !p.imageAtlasCoordsTexture) {
    p.createAtlas()
    if (!p.imageAtlasTexture || !p.imageAtlasCoordsTexture) return
  }
  const imageAtlasTexture = p.imageAtlasTexture
  const imageAtlasCoordsTexture = p.imageAtlasCoordsTexture
  if (imageAtlasTexture.destroyed || imageAtlasCoordsTexture.destroyed) return

  if (!data.pointsNumber || data.pointsNumber === 0) return
  if (!store.screenSize || store.screenSize[0] === 0 || store.screenSize[1] === 0) return

  const drawBindings = drawPointRenderPass({
    renderPass,
    usePreparedCulledDraw,
    device,
    data,
    config,
    store,
    drawCommand,
    drawUniformStore,
    drawUniformPayload: p.drawUniformPayload,
    drawVertexUniforms: p.drawVertexUniformScratch,
    drawFragmentUniforms: p.drawFragmentUniformScratch,
    drawHighlightedCommand: p.drawHighlightedCommand,
    drawHighlightedUniformStore: p.drawHighlightedUniformStore,
    drawHighlightedUniformPayload: p.drawHighlightedUniformPayload,
    currentPositionTexture,
    positionStorageBuffer: p.positionStorageBuffer,
    previousRenderPositionStorageBuffer: p.previousRenderPositionStorageBuffer,
    pointStatusTexture,
    pointStatusStorageBuffer: p.pointStatusStorageBuffer,
    imageAtlasTexture,
    imageAtlasCoordsTexture,
    imageCount: p.imageCount,
    imageAtlasCoordsTextureSize: p.imageAtlasCoordsTextureSize,
    pointLodStrength: p.getEffectivePointLodStrength(),
    renderPositionMix: p.renderPositionMix,
    effectivePixelRatio: p.effectivePixelRatio,
    hasNonCircleShapes: p.hasNonCircleShapes,
    isCulledPointDrawPrepared: p.isCulledPointDrawPrepared,
    drawBindings: getDrawBindingCache(p),
    drawCulledPointsIndirect: (activeRenderPass) => p.drawCulledPointsIndirect(activeRenderPass),
  })
  setDrawBindingCache(p, drawBindings)
}

export function drawCulledPointsIndirect (points: unknown, renderPass: RenderPass): boolean {
  const p = runtime(points)
  const result = drawCulledPointsIndirectState({
    device: p.device,
    state: {
      command: p.drawCulledCommand,
      quadVertexBuffer: p.drawQuadVertexBuffer,
    },
    uniformStore: p.drawUniformStore,
    sampleCount: p.config.msaa,
    positionStorageBuffer: p.positionStorageBuffer,
    previousRenderPositionStorageBuffer: p.previousRenderPositionStorageBuffer,
    pointStatusStorageBuffer: p.pointStatusStorageBuffer,
    colorBuffer: p.colorBuffer,
    sizeBuffer: p.sizeBuffer,
    visiblePointIndexBuffer: p.visiblePointIndexBuffer,
    visiblePointIndirectBuffer: p.visiblePointIndirectBuffer,
    renderPass,
  })
  p.drawCulledCommand = result.state.command
  p.drawQuadVertexBuffer = result.state.quadVertexBuffer
  return result.drew
}

export function ensureDensityImpostorTarget (points: unknown): void {
  const p = runtime(points)
  const densityScale = Math.max(1, Math.round(p.config.impostorDensityScale || 4))
  const state = ensureDensityImpostorTargetState({
    device: p.device,
    texture: p.densityImpostorTexture,
    framebuffer: p.densityImpostorFbo,
    size: p.densityImpostorSize,
    screenSize: p.store.screenSize,
    ratio: p.effectivePixelRatio,
    densityScale,
  })
  p.densityImpostorTexture = state.texture
  p.densityImpostorFbo = state.framebuffer
  p.densityImpostorSize = state.size
}

export function initDensityImpostorCommands (points: unknown): void {
  const p = runtime(points)
  if (p.device.info?.type !== 'webgpu') return
  p.drawQuadVertexBuffer ||= createFullscreenQuadBuffer(p.device)
  const state = ensureDensityImpostorRenderCommands({
    device: p.device,
    impostorCommand: p.densityImpostorCommand,
    compositeCommand: p.densityCompositeCommand,
    impostorUniformStore: p.densityImpostorUniformStore,
    compositeUniformStore: p.densityCompositeUniformStore,
    quadVertexBuffer: p.drawQuadVertexBuffer,
    sizeBuffer: p.sizeBuffer,
    colorBuffer: p.colorBuffer,
    ratio: p.effectivePixelRatio,
    transformationMatrix: p.store.transformationMatrix4x4,
    spaceSize: p.store.adjustedSpaceSize,
    screenSize: p.store.screenSize,
    sizeScale: p.config.pointSizeScale,
    pointOpacity: p.config.pointOpacity,
    maxPointSize: p.store.maxPointSize,
    densityPointSizeScale: p.config.impostorPointSizeScale,
    pointCount: p.data.pointsNumber ?? 0,
    sampleCount: p.config.msaa,
    compositeStrength: p.config.impostorCompositeStrength,
  })
  p.densityImpostorUniformStore = state.impostorUniformStore
  p.densityCompositeUniformStore = state.compositeUniformStore
  p.densityImpostorCommand = state.impostorCommand
  p.densityCompositeCommand = state.compositeCommand
}
