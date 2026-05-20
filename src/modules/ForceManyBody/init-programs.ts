import type { Buffer, ComputePipeline, Device, Shader, UniformStore } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import type { GraphConfigInterface } from '@/graph/config'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Points } from '@/graph/modules/Points'
import type { Store } from '@/graph/modules/Store'

import { createForceComputeResources } from './compute'
import { createForceVertexCoordData } from './constants'
import type {
  CalculateLevelsUniformStoreShape,
  ForceCenterUniformStoreShape,
  ForceComputeUniformStoreShape,
  ForceUniformStoreShape,
} from './contracts'
import {
  createCalculateLevelsCommand,
  createForceCenterCommand,
  createForceCommand,
} from './pass-setup'
import {
  createCalculateLevelsUniformStore,
  createForceCenterUniformStore,
  createForceUniformStore,
} from './uniforms'

export type InitForceManyBodyProgramsOptions = {
  device: Device;
  config: GraphConfigInterface;
  store: Store;
  data: GraphData;
  points: Points | undefined;
  levels: number;
  pointIndices: Buffer | undefined;
  calculateLevelsCommand: Model | undefined;
  calculateLevelsUniformStore: UniformStore<CalculateLevelsUniformStoreShape> | undefined;
  forceCommand: Model | undefined;
  forceFromItsOwnCentermassCommand: Model | undefined;
  forceUniformStore: UniformStore<ForceUniformStoreShape> | undefined;
  forceCenterUniformStore: UniformStore<ForceCenterUniformStoreShape> | undefined;
  forceVertexCoordBuffer: Buffer | undefined;
  forceComputePipeline: ComputePipeline | undefined;
  forceComputeUniformStore: UniformStore<ForceComputeUniformStoreShape> | undefined;
  forceComputeUniformBuffer: Buffer | undefined;
}

export type InitForceManyBodyProgramsResult = Partial<{
  calculateLevelsCommand: Model;
  calculateLevelsUniformStore: UniformStore<CalculateLevelsUniformStoreShape>;
  forceCommand: Model;
  forceFromItsOwnCentermassCommand: Model;
  forceUniformStore: UniformStore<ForceUniformStoreShape>;
  forceCenterUniformStore: UniformStore<ForceCenterUniformStoreShape>;
  forceVertexCoordBuffer: Buffer;
  forceComputePipeline: ComputePipeline;
  forceComputeShader: Shader;
  forceComputeUniformStore: UniformStore<ForceComputeUniformStoreShape>;
  forceComputeUniformBuffer: Buffer;
  forceComputeCompiledLevels: number;
}>

export function initForceManyBodyPrograms (
  options: InitForceManyBodyProgramsOptions
): InitForceManyBodyProgramsResult {
  const { device, store, data, points } = options
  if (!data.pointsNumber || !points || !store.pointsTextureSize) return {}

  const calculateLevelsUniformStore =
    options.calculateLevelsUniformStore ?? createCalculateLevelsUniformStore(store.pointsTextureSize)
  const calculateLevelsCommand =
    options.calculateLevelsCommand ?? createCalculateLevelsCommand({
      device,
      vertexCount: data.pointsNumber,
      pointIndices: options.pointIndices,
      uniformStore: calculateLevelsUniformStore,
    })
  const forceUniformStore =
    options.forceUniformStore ?? createForceUniformStore({
      levels: options.levels,
      alpha: store.alpha,
      repulsion: options.config.simulationRepulsion,
      spaceSize: store.adjustedSpaceSize,
      theta: options.config.simulationRepulsionTheta,
    })
  const forceVertexCoordBuffer =
    options.forceVertexCoordBuffer ?? device.createBuffer({ data: createForceVertexCoordData() })
  const forceCommand =
    options.forceCommand ?? createForceCommand({
      device,
      vertexCoordBuffer: forceVertexCoordBuffer,
      uniformStore: forceUniformStore,
    })
  const forceCenterUniformStore =
    options.forceCenterUniformStore ?? createForceCenterUniformStore({
      alpha: store.alpha,
      repulsion: options.config.simulationRepulsion,
    })
  const forceFromItsOwnCentermassCommand =
    options.forceFromItsOwnCentermassCommand ?? createForceCenterCommand({
      device,
      vertexCoordBuffer: forceVertexCoordBuffer,
      uniformStore: forceCenterUniformStore,
    })

  const result: InitForceManyBodyProgramsResult = {
    calculateLevelsUniformStore,
    calculateLevelsCommand,
    forceUniformStore,
    forceVertexCoordBuffer,
    forceCommand,
    forceCenterUniformStore,
    forceFromItsOwnCentermassCommand,
  }

  if (device.info?.type === 'webgpu') {
    Object.assign(result, createForceComputeResources({
      device,
      levels: options.levels,
      forceComputePipeline: options.forceComputePipeline,
      forceComputeUniformStore: options.forceComputeUniformStore,
      forceComputeUniformBuffer: options.forceComputeUniformBuffer,
    }))
  }

  return result
}
