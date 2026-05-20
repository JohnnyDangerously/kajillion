import type { ForceLinkState } from './contracts'

export function destroyForceLinkPrograms (state: ForceLinkState): void {
  state.runCommand?.destroy()
  state.runCommand = undefined
  state.runComputePipeline?.destroy()
  state.runComputePipeline = undefined
  state.runComputeShader?.destroy()
  state.runComputeShader = undefined
}

/**
 * Destruction order matters:
 * Models -> Framebuffers -> Textures -> UniformStores -> Buffers.
 */
export function destroyForceLinkState (state: ForceLinkState): void {
  destroyForceLinkPrograms(state)

  if (state.linkFirstIndicesAndAmountTexture && !state.linkFirstIndicesAndAmountTexture.destroyed) {
    state.linkFirstIndicesAndAmountTexture.destroy()
  }
  state.linkFirstIndicesAndAmountTexture = undefined

  if (state.indicesTexture && !state.indicesTexture.destroyed) {
    state.indicesTexture.destroy()
  }
  state.indicesTexture = undefined
  state.biasAndStrengthTexture = undefined
  state.randomDistanceTexture = undefined

  state.uniformBuffer = undefined
  state.uniformStore?.destroy()
  state.uniformStore = undefined

  if (state.vertexCoordBuffer && !state.vertexCoordBuffer.destroyed) {
    state.vertexCoordBuffer.destroy()
  }
  state.vertexCoordBuffer = undefined
}
