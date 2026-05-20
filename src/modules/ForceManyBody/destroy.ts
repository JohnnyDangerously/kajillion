import type { Buffer, ComputePipeline, Shader, Texture, UniformStore } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'

import type {
  CalculateLevelsUniformStoreShape,
  ForceCenterUniformStoreShape,
  ForceComputeUniformStoreShape,
  ForceUniformStoreShape,
  LevelTarget,
} from './contracts'

export type DestroyForceManyBodyResourcesOptions = {
  calculateLevelsCommand: Model | undefined;
  forceCommand: Model | undefined;
  forceFromItsOwnCentermassCommand: Model | undefined;
  forceComputePipeline: ComputePipeline | undefined;
  forceComputeShader: Shader | undefined;
  levelTargets: Map<number, LevelTarget>;
  randomValuesTexture: Texture | undefined;
  calculateLevelsUniformStore: UniformStore<CalculateLevelsUniformStoreShape> | undefined;
  forceUniformStore: UniformStore<ForceUniformStoreShape> | undefined;
  forceCenterUniformStore: UniformStore<ForceCenterUniformStoreShape> | undefined;
  forceComputeUniformStore: UniformStore<ForceComputeUniformStoreShape> | undefined;
  pointIndices: Buffer | undefined;
  forceVertexCoordBuffer: Buffer | undefined;
}

export type DestroyForceManyBodyResourcesResult = {
  calculateLevelsCommand: undefined;
  forceCommand: undefined;
  forceFromItsOwnCentermassCommand: undefined;
  forceComputePipeline: undefined;
  forceComputeShader: undefined;
  forceComputeCompiledLevels: undefined;
  randomValuesTexture: undefined;
  calculateLevelsUniformStore: undefined;
  forceUniformStore: undefined;
  forceCenterUniformStore: undefined;
  forceComputeUniformBuffer: undefined;
  forceComputeUniformStore: undefined;
  pointIndices: undefined;
  forceVertexCoordBuffer: undefined;
}

export function destroyForceManyBodyResources (
  options: DestroyForceManyBodyResourcesOptions
): DestroyForceManyBodyResourcesResult {
  options.calculateLevelsCommand?.destroy()
  options.forceCommand?.destroy()
  options.forceFromItsOwnCentermassCommand?.destroy()
  options.forceComputePipeline?.destroy()
  options.forceComputeShader?.destroy()

  for (const target of options.levelTargets.values()) {
    if (target.fbo && !target.fbo.destroyed) {
      target.fbo.destroy()
    }
  }

  if (options.randomValuesTexture && !options.randomValuesTexture.destroyed) {
    options.randomValuesTexture.destroy()
  }

  for (const target of options.levelTargets.values()) {
    if (target.texture && !target.texture.destroyed) {
      target.texture.destroy()
    }
  }
  options.levelTargets.clear()

  options.calculateLevelsUniformStore?.destroy()
  options.forceUniformStore?.destroy()
  options.forceCenterUniformStore?.destroy()
  options.forceComputeUniformStore?.destroy()

  if (options.pointIndices && !options.pointIndices.destroyed) {
    options.pointIndices.destroy()
  }
  if (options.forceVertexCoordBuffer && !options.forceVertexCoordBuffer.destroyed) {
    options.forceVertexCoordBuffer.destroy()
  }

  return {
    calculateLevelsCommand: undefined,
    forceCommand: undefined,
    forceFromItsOwnCentermassCommand: undefined,
    forceComputePipeline: undefined,
    forceComputeShader: undefined,
    forceComputeCompiledLevels: undefined,
    randomValuesTexture: undefined,
    calculateLevelsUniformStore: undefined,
    forceUniformStore: undefined,
    forceCenterUniformStore: undefined,
    forceComputeUniformBuffer: undefined,
    forceComputeUniformStore: undefined,
    pointIndices: undefined,
    forceVertexCoordBuffer: undefined,
  }
}
