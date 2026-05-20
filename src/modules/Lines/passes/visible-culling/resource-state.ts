import type { ActiveLineMaskState } from '@/graph/modules/Lines/passes/visible-culling/active-mask'
import type { VisibleLineBufferState } from '@/graph/modules/Lines/passes/visible-culling/buffers'
import type { VisibleLinePipelineState } from '@/graph/modules/Lines/passes/visible-culling/pipelines'

export function createVisibleLineBufferState (): VisibleLineBufferState {
  return {
    visibleLineIndexBuffer: undefined,
    visibleLineIndirectBuffer: undefined,
    visibleLineCapacity: 0,
  }
}

export function createActiveLineMaskState (): ActiveLineMaskState {
  return {
    activeLineMaskBuffer: undefined,
    activeLineMaskCapacity: 0,
    activeLineMaskSignature: '',
    activeLineMaskLinkCount: 0,
    activeLineMaskDirty: true,
    activeLineMaskIndicesRef: undefined,
  }
}

export function createVisibleLinePipelineState (): VisibleLinePipelineState {
  return {
    clearShader: undefined,
    clearPipeline: undefined,
    clearUniformStore: undefined,
    clearUniformBuffer: undefined,
    cullShader: undefined,
    cullPipeline: undefined,
    cullUniformStore: undefined,
    cullUniformBuffer: undefined,
  }
}

export function destroyVisibleLineBufferState (state: VisibleLineBufferState): VisibleLineBufferState {
  if (state.visibleLineIndexBuffer && !state.visibleLineIndexBuffer.destroyed) {
    state.visibleLineIndexBuffer.destroy()
  }
  if (state.visibleLineIndirectBuffer && !state.visibleLineIndirectBuffer.destroyed) {
    state.visibleLineIndirectBuffer.destroy()
  }
  return createVisibleLineBufferState()
}

export function destroyActiveLineMaskState (state: ActiveLineMaskState): ActiveLineMaskState {
  if (state.activeLineMaskBuffer && !state.activeLineMaskBuffer.destroyed) {
    state.activeLineMaskBuffer.destroy()
  }
  return createActiveLineMaskState()
}

export function destroyVisibleLinePipelineState (state: VisibleLinePipelineState): VisibleLinePipelineState {
  state.clearPipeline?.destroy()
  state.clearShader?.destroy()
  state.clearUniformStore?.destroy()
  state.cullPipeline?.destroy()
  state.cullShader?.destroy()
  state.cullUniformStore?.destroy()
  return createVisibleLinePipelineState()
}
