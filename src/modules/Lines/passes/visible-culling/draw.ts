import type { Buffer, Device, RenderPass, Texture, UniformStore } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import type { Points } from '@/graph/modules/Points'
import type { LineDrawUniformStoreShape } from '@/graph/modules/Lines/passes/draw/contracts'
import { drawModelIndirect } from '@/graph/modules/Lines/passes/visible-culling/indirect-draw'

export interface VisibleLineDrawHost {
  readonly device: Device;
  readonly points: Points | undefined;
}

export interface VisibleLineDrawInput {
  host: VisibleLineDrawHost;
  prepared: boolean;
  renderPass: RenderPass;
  model: Model | undefined;
  drawLineUniformStore: UniformStore<LineDrawUniformStoreShape> | undefined;
  linkStatusTexture: Texture | undefined;
  pointABuffer: Buffer | undefined;
  pointBBuffer: Buffer | undefined;
  colorBuffer: Buffer | undefined;
  widthBuffer: Buffer | undefined;
  arrowBuffer: Buffer | undefined;
  visibleLineIndexBuffer: Buffer | undefined;
  visibleLineIndirectBuffer: Buffer | undefined;
}

export function drawVisibleLines (input: VisibleLineDrawInput): boolean {
  const {
    arrowBuffer,
    colorBuffer,
    drawLineUniformStore,
    host,
    linkStatusTexture,
    model,
    pointABuffer,
    pointBBuffer,
    prepared,
    renderPass,
    visibleLineIndexBuffer,
    visibleLineIndirectBuffer,
    widthBuffer,
  } = input
  const { device, points } = host
  if (device.info?.type !== 'webgpu' || !prepared) return false
  if (!model || !drawLineUniformStore || !linkStatusTexture) return false
  if (!points?.positionStorageBuffer || points.positionStorageBuffer.destroyed) return false
  if (!points.previousRenderPositionStorageBuffer || points.previousRenderPositionStorageBuffer.destroyed) return false
  if (!pointABuffer || pointABuffer.destroyed) return false
  if (!pointBBuffer || pointBBuffer.destroyed) return false
  if (!colorBuffer || colorBuffer.destroyed) return false
  if (!widthBuffer || widthBuffer.destroyed) return false
  if (!arrowBuffer || arrowBuffer.destroyed) return false
  if (!visibleLineIndexBuffer || visibleLineIndexBuffer.destroyed) return false
  if (!visibleLineIndirectBuffer || visibleLineIndirectBuffer.destroyed) return false

  model.setBindings({
    drawLineUniforms: drawLineUniformStore.getManagedUniformBuffer(device, 'drawLineUniforms'),
    drawLineFragmentUniforms: drawLineUniformStore.getManagedUniformBuffer(device, 'drawLineFragmentUniforms'),
    positions: points.positionStorageBuffer,
    linkStatus: linkStatusTexture,
    pointAArr: pointABuffer,
    pointBArr: pointBBuffer,
    previousPositions: points.previousRenderPositionStorageBuffer,
    colorArr: colorBuffer,
    widthArr: widthBuffer,
    arrowArr: arrowBuffer,
    visibleIndices: visibleLineIndexBuffer,
  })
  return drawModelIndirect(model, renderPass, visibleLineIndirectBuffer)
}
