import type { ForceLinkState } from './contracts'

export function createForceLinkState (): ForceLinkState {
  return {
    linkFirstIndicesAndAmount: new Float32Array(),
    indices: new Float32Array(),
    maxPointDegree: 0,
    previousMaxPointDegree: undefined,
    previousPointsTextureSize: undefined,
    previousLinksTextureSize: undefined,
    runCommand: undefined,
    vertexCoordBuffer: undefined,
    runComputeShader: undefined,
    runComputePipeline: undefined,
    uniformStore: undefined,
    uniformBuffer: undefined,
    linkFirstIndicesAndAmountTexture: undefined,
    indicesTexture: undefined,
    biasAndStrengthTexture: undefined,
    randomDistanceTexture: undefined,
  }
}
