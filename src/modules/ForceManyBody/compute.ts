import type { Buffer, ComputePipeline, Device, Shader, UniformStore } from '@luma.gl/core'

import type { ForceComputeUniformStoreShape } from './contracts'
import {
  createForceComputePipeline,
  createForceComputeShader,
} from './pass-setup'
import { createForceComputeUniformStore } from './uniforms'

export type CreateForceComputeResourcesOptions = {
  device: Device;
  levels: number;
  forceComputePipeline: ComputePipeline | undefined;
  forceComputeUniformStore: UniformStore<ForceComputeUniformStoreShape> | undefined;
  forceComputeUniformBuffer: Buffer | undefined;
}

export type CreateForceComputeResourcesResult = Partial<{
  forceComputeUniformStore: UniformStore<ForceComputeUniformStoreShape>;
  forceComputeUniformBuffer: Buffer;
  forceComputeShader: Shader;
  forceComputePipeline: ComputePipeline;
  forceComputeCompiledLevels: number;
}>

export function createForceComputeResources (
  options: CreateForceComputeResourcesOptions
): CreateForceComputeResourcesResult {
  if (options.forceComputePipeline) return {}
  if (options.levels <= 0) return {}

  const forceComputeUniformStore =
    options.forceComputeUniformStore ?? createForceComputeUniformStore()
  const forceComputeUniformBuffer =
    options.forceComputeUniformBuffer ??
    forceComputeUniformStore.getManagedUniformBuffer(options.device, 'forceComputeUniforms')
  const forceComputeShader = createForceComputeShader(options.device, options.levels)
  const forceComputePipeline = createForceComputePipeline(
    options.device,
    forceComputeShader,
    options.levels
  )

  return {
    forceComputeUniformStore,
    forceComputeUniformBuffer,
    forceComputeShader,
    forceComputePipeline,
    forceComputeCompiledLevels: options.levels,
  }
}
