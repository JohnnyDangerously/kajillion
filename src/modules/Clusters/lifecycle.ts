import type { Buffer, Device, Framebuffer, Texture, UniformStore } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'

import { createOrUpdatePointIndices, destroyBufferIfAlive } from './buffers'
import type {
  ApplyForcesUniformStoreShape,
  CalculateCentermassUniformStoreShape,
} from './contracts'
import {
  createOrUpdateClusterGpuResources,
  destroyTextureIfAlive,
} from './resources'
import {
  getClusterCount,
  getClustersTextureSize,
} from './state'

export type ClusterRuntimeState = {
  clusterCount: number;
  clustersTextureSize: number;
  clusterTexture: Texture;
  clusterPositionsTexture: Texture;
  clusterForceCoefficientTexture: Texture;
  centermassTexture: Texture;
  centermassFbo: Framebuffer | undefined;
  pointIndices: Buffer;
  previousPointsTextureSize: number;
  previousClustersTextureSize: number;
  previousClusterCount: number;
}

export type DestroyedClusterRuntimeState = {
  calculateCentermassCommand: undefined;
  applyForcesCommand: undefined;
  centermassFbo: undefined;
  clusterTexture: undefined;
  clusterPositionsTexture: undefined;
  clusterForceCoefficientTexture: undefined;
  centermassTexture: undefined;
  calculateCentermassUniformStore: undefined;
  applyForcesUniformStore: undefined;
  pointIndices: undefined;
  applyForcesVertexCoordBuffer: undefined;
}

export function createClusterRuntimeState (options: {
  device: Device;
  pointsTextureSize: number;
  pointsNumber: number | undefined;
  pointClusters: (number | undefined)[] | undefined;
  clusterPositionValues: (number | undefined)[] | undefined;
  clusterStrength: Float32Array | undefined;
  previousPointsTextureSize: number | undefined;
  previousClustersTextureSize: number | undefined;
  previousClusterCount: number | undefined;
  clusterTexture: Texture | undefined;
  clusterPositionsTexture: Texture | undefined;
  clusterForceCoefficientTexture: Texture | undefined;
  centermassTexture: Texture | undefined;
  centermassFbo: Framebuffer | undefined;
  pointIndices: Buffer | undefined;
  calculateCentermassCommand: Model | undefined;
}): ClusterRuntimeState | undefined {
  if (options.pointsNumber === undefined || (!options.pointClusters && !options.clusterPositionValues)) return undefined

  const clusterCount = getClusterCount(options.pointClusters)
  const clustersTextureSize = getClustersTextureSize(clusterCount)
  const sizesChanged =
    options.previousPointsTextureSize !== options.pointsTextureSize ||
    options.previousClustersTextureSize !== clustersTextureSize ||
    options.previousClusterCount !== clusterCount

  const resources = createOrUpdateClusterGpuResources({
    device: options.device,
    pointsTextureSize: options.pointsTextureSize,
    clustersTextureSize,
    clusterCount,
    pointsNumber: options.pointsNumber,
    pointClusters: options.pointClusters,
    clusterPositionValues: options.clusterPositionValues,
    clusterStrength: options.clusterStrength,
    sizesChanged,
    previousClustersTextureSize: options.previousClustersTextureSize,
    clusterTexture: options.clusterTexture,
    clusterPositionsTexture: options.clusterPositionsTexture,
    clusterForceCoefficientTexture: options.clusterForceCoefficientTexture,
    centermassTexture: options.centermassTexture,
    centermassFbo: options.centermassFbo,
  })

  return {
    ...resources,
    clusterCount,
    clustersTextureSize,
    pointIndices: createOrUpdatePointIndices({
      device: options.device,
      pointIndices: options.pointIndices,
      pointsTextureSize: options.pointsTextureSize,
      previousPointsTextureSize: options.previousPointsTextureSize,
      calculateCentermassCommand: options.calculateCentermassCommand,
    }),
    previousPointsTextureSize: options.pointsTextureSize,
    previousClustersTextureSize: clustersTextureSize,
    previousClusterCount: clusterCount,
  }
}

export function destroyClusterRuntimeState (options: {
  calculateCentermassCommand: Model | undefined;
  applyForcesCommand: Model | undefined;
  centermassFbo: Framebuffer | undefined;
  clusterTexture: Texture | undefined;
  clusterPositionsTexture: Texture | undefined;
  clusterForceCoefficientTexture: Texture | undefined;
  centermassTexture: Texture | undefined;
  calculateCentermassUniformStore: UniformStore<CalculateCentermassUniformStoreShape> | undefined;
  applyForcesUniformStore: UniformStore<ApplyForcesUniformStoreShape> | undefined;
  pointIndices: Buffer | undefined;
  applyForcesVertexCoordBuffer: Buffer | undefined;
}): DestroyedClusterRuntimeState {
  options.calculateCentermassCommand?.destroy()
  options.applyForcesCommand?.destroy()

  if (options.centermassFbo && !options.centermassFbo.destroyed) {
    options.centermassFbo.destroy()
  }

  destroyTextureIfAlive(options.clusterTexture)
  destroyTextureIfAlive(options.clusterPositionsTexture)
  destroyTextureIfAlive(options.clusterForceCoefficientTexture)
  destroyTextureIfAlive(options.centermassTexture)

  options.calculateCentermassUniformStore?.destroy()
  options.applyForcesUniformStore?.destroy()

  destroyBufferIfAlive(options.pointIndices)
  destroyBufferIfAlive(options.applyForcesVertexCoordBuffer)

  return {
    calculateCentermassCommand: undefined,
    applyForcesCommand: undefined,
    centermassFbo: undefined,
    clusterTexture: undefined,
    clusterPositionsTexture: undefined,
    clusterForceCoefficientTexture: undefined,
    centermassTexture: undefined,
    calculateCentermassUniformStore: undefined,
    applyForcesUniformStore: undefined,
    pointIndices: undefined,
    applyForcesVertexCoordBuffer: undefined,
  }
}
