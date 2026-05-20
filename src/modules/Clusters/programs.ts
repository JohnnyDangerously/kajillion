import type { Buffer, Device, UniformStore } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'

import { createApplyForcesVertexCoordData } from './constants'
import type {
  ApplyForcesUniformStoreShape,
  CalculateCentermassUniformStoreShape,
} from './contracts'
import {
  createApplyForcesCommand,
  createCalculateCentermassCommand,
} from './pass-setup'
import {
  createApplyForcesUniformStore,
  createCalculateCentermassUniformStore,
} from './uniforms'

export type ClusterPrograms = {
  calculateCentermassUniformStore: UniformStore<CalculateCentermassUniformStoreShape>;
  calculateCentermassCommand: Model;
  applyForcesUniformStore: UniformStore<ApplyForcesUniformStoreShape>;
  applyForcesVertexCoordBuffer: Buffer;
  applyForcesCommand: Model;
}

export function initializeClusterPrograms (options: {
  device: Device;
  pointsTextureSize: number;
  pointsNumber: number;
  alpha: number;
  clustersTextureSize: number;
  simulationCluster: number;
  pointIndices: Buffer | undefined;
  calculateCentermassUniformStore: UniformStore<CalculateCentermassUniformStoreShape> | undefined;
  calculateCentermassCommand: Model | undefined;
  applyForcesUniformStore: UniformStore<ApplyForcesUniformStoreShape> | undefined;
  applyForcesVertexCoordBuffer: Buffer | undefined;
  applyForcesCommand: Model | undefined;
}): ClusterPrograms {
  const calculateCentermassUniformStore = options.calculateCentermassUniformStore ?? createCalculateCentermassUniformStore({
    pointsTextureSize: options.pointsTextureSize,
    clustersTextureSize: options.clustersTextureSize,
  })

  const calculateCentermassCommand = options.calculateCentermassCommand ?? createCalculateCentermassCommand({
    device: options.device,
    vertexCount: options.pointsNumber,
    pointIndices: options.pointIndices,
    uniformStore: calculateCentermassUniformStore,
  })

  const applyForcesUniformStore = options.applyForcesUniformStore ?? createApplyForcesUniformStore({
    alpha: options.alpha,
    clustersTextureSize: options.clustersTextureSize,
    clusterCoefficient: options.simulationCluster,
  })

  const applyForcesVertexCoordBuffer = options.applyForcesVertexCoordBuffer ?? options.device.createBuffer({
    data: createApplyForcesVertexCoordData(),
  })

  const applyForcesCommand = options.applyForcesCommand ?? createApplyForcesCommand({
    device: options.device,
    vertexCoordBuffer: applyForcesVertexCoordBuffer,
    uniformStore: applyForcesUniformStore,
  })

  return {
    calculateCentermassUniformStore,
    calculateCentermassCommand,
    applyForcesUniformStore,
    applyForcesVertexCoordBuffer,
    applyForcesCommand,
  }
}
