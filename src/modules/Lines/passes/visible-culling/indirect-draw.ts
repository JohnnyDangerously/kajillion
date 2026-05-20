import type { Buffer, RenderPass } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import type {
  IndirectModelAccess,
  WebGpuBufferAccess,
  WebGpuRenderPassAccess,
} from '@/graph/modules/Lines/passes/shared/contracts'

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
