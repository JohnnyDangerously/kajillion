import type { Buffer, Device, RenderPass, UniformStore } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import { ensureCulledPointDrawCommand } from '@/graph/modules/Points/passes/draw/setup'
import type { PointDrawUniforms } from '@/graph/modules/Points/passes/draw/contracts'
import type {
  IndirectModelAccess,
  WebGpuBufferAccess,
  WebGpuRenderPassAccess,
} from '@/graph/modules/Points/passes/shared/contracts'

export type CulledPointDrawCommandState = {
  command: Model | undefined;
  quadVertexBuffer: Buffer | undefined;
}

export type CulledPointDrawCommandResources = {
  device: Device;
  state: CulledPointDrawCommandState;
  uniformStore: UniformStore<PointDrawUniforms> | undefined;
  sampleCount: number;
}

export type CulledPointDrawResources = CulledPointDrawCommandResources & {
  positionStorageBuffer: Buffer | undefined;
  previousRenderPositionStorageBuffer: Buffer | undefined;
  pointStatusStorageBuffer: Buffer | undefined;
  colorBuffer: Buffer | undefined;
  sizeBuffer: Buffer | undefined;
  visiblePointIndexBuffer: Buffer | undefined;
  visiblePointIndirectBuffer: Buffer | undefined;
  renderPass: RenderPass;
}

export type CulledPointDrawResult = {
  drew: boolean;
  state: CulledPointDrawCommandState;
}

export function ensureVisibleCulledPointDrawCommand (
  options: CulledPointDrawCommandResources,
): CulledPointDrawCommandState {
  if (options.device.info?.type !== 'webgpu') return options.state
  if (!options.uniformStore) return options.state
  const state = ensureCulledPointDrawCommand({
    device: options.device,
    command: options.state.command,
    uniformStore: options.uniformStore,
    quadVertexBuffer: options.state.quadVertexBuffer,
    sampleCount: options.sampleCount,
  })
  return {
    command: state.command,
    quadVertexBuffer: state.quadVertexBuffer,
  }
}

export function drawCulledPointsIndirect (
  options: CulledPointDrawResources,
): CulledPointDrawResult {
  const skipped = { drew: false, state: options.state }
  if (!options.uniformStore) return skipped
  if (!isLiveBuffer(options.positionStorageBuffer)) return skipped
  if (!isLiveBuffer(options.previousRenderPositionStorageBuffer)) return skipped
  if (!isLiveBuffer(options.pointStatusStorageBuffer)) return skipped
  if (!isLiveBuffer(options.colorBuffer)) return skipped
  if (!isLiveBuffer(options.sizeBuffer)) return skipped
  if (!isLiveBuffer(options.visiblePointIndexBuffer)) return skipped
  if (!isLiveBuffer(options.visiblePointIndirectBuffer)) return skipped

  const state = ensureVisibleCulledPointDrawCommand(options)
  if (!state.command) return { drew: false, state }

  state.command.setBindings({
    drawVertexUniforms: options.uniformStore.getManagedUniformBuffer(options.device, 'drawVertexUniforms'),
    drawFragmentUniforms: options.uniformStore.getManagedUniformBuffer(options.device, 'drawFragmentUniforms'),
    positions: options.positionStorageBuffer,
    previousPositions: options.previousRenderPositionStorageBuffer,
    pointStatusBuf: options.pointStatusStorageBuffer,
    colors: options.colorBuffer,
    sizes: options.sizeBuffer,
    visibleIndices: options.visiblePointIndexBuffer,
  })
  return {
    drew: drawModelIndirect(state.command, options.renderPass, options.visiblePointIndirectBuffer),
    state,
  }
}

export function drawModelIndirect (model: Model, renderPass: RenderPass, indirectBuffer: Buffer): boolean {
  const modelAccess = model as unknown as IndirectModelAccess
  const webPass = renderPass as unknown as WebGpuRenderPassAccess
  const webBuffer = indirectBuffer as unknown as WebGpuBufferAccess
  if (!webPass.handle || !webBuffer.handle) return false
  if (modelAccess._areBindingsLoading?.()) return false
  if (!modelAccess._getBindings || !modelAccess._updatePipeline) return false

  modelAccess.predraw()
  modelAccess.pipeline = modelAccess._updatePipeline()
  modelAccess.pipeline.setBindings(modelAccess._getBindings(), { disableWarnings: true })
  if (!modelAccess.pipeline.handle) return false

  webPass.handle.setPipeline(modelAccess.pipeline.handle)
  const bindGroup = modelAccess.pipeline._getBindGroup?.()
  if (bindGroup) webPass.handle.setBindGroup(0, bindGroup)
  modelAccess.vertexArray.bindBeforeRender(renderPass)
  webPass.handle.drawIndirect(webBuffer.handle, 0)
  modelAccess.vertexArray.unbindAfterRender(renderPass)
  return true
}

function isLiveBuffer (buffer: Buffer | undefined): buffer is Buffer {
  return !!buffer && !buffer.destroyed
}
