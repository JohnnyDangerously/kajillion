import type { Buffer, RenderPass, Texture, UniformStore } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import type { PointDrawBindingCache } from '@/graph/modules/Points/passes/draw/bindings'
import type {
  PointDrawUniforms,
  PointDrawVertexUniforms,
} from '@/graph/modules/Points/passes/draw/contracts'
import type { PointDrawBackend } from '@/graph/modules/Points/passes/draw/lifecycle'
import { refreshPointDrawBindings } from '@/graph/modules/Points/passes/draw/bindings'
import { setPointDrawLayerFlags } from '@/graph/modules/Points/passes/draw/lifecycle'

type DrawMainPointsDirectOptions = {
  renderPass: RenderPass;
  backend: PointDrawBackend;
  drawCommand: Model;
  drawUniformStore: UniformStore<PointDrawUniforms>;
  drawUniformPayload: PointDrawUniforms;
  drawVertexUniforms: PointDrawVertexUniforms;
  currentPositionTexture: Texture;
  positionStorageBuffer: Buffer | undefined;
  previousRenderPositionStorageBuffer: Buffer | undefined;
  pointStatusTexture: Texture;
  pointStatusStorageBuffer: Buffer | undefined;
  imageAtlasTexture: Texture;
  imageAtlasCoordsTexture: Texture;
  hasHighlighting: boolean;
  drawBindings: PointDrawBindingCache;
}

export function drawMainPointsDirect (
  options: DrawMainPointsDirectOptions
): PointDrawBindingCache {
  const {
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
  } = options

  const position = backend === 'webgpu' ? positionStorageBuffer : currentPositionTexture
  const previousPosition = backend === 'webgpu' ? previousRenderPositionStorageBuffer : undefined
  const pointStatusBuffer = backend === 'webgpu' ? pointStatusStorageBuffer : undefined
  if (!position) return drawBindings
  if (backend === 'webgpu' && !previousPosition) return drawBindings

  const updatedDrawBindings = refreshPointDrawBindings({
    backend,
    drawCommand,
    position,
    previousPosition,
    pointStatusTexture,
    pointStatusBuffer,
    imageAtlasTexture,
    imageAtlasCoordsTexture,
    drawBindings,
  })

  if (hasHighlighting) {
    setPointDrawLayerFlags(drawVertexUniforms, 'greyed')
    drawUniformStore.setUniforms(drawUniformPayload)
    drawCommand.draw(renderPass)

    setPointDrawLayerFlags(drawVertexUniforms, 'highlighted')
    drawUniformStore.setUniforms(drawUniformPayload)
    drawCommand.draw(renderPass)
  } else {
    setPointDrawLayerFlags(drawVertexUniforms, 'all')
    drawUniformStore.setUniforms(drawUniformPayload)
    drawCommand.draw(renderPass)
  }

  return updatedDrawBindings
}
