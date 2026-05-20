import { UniformStore } from '@luma.gl/core'

import type {
  ApplyForcesUniformStoreShape,
  CalculateCentermassUniformStoreShape,
} from './contracts'

export function createCalculateCentermassUniformStore (options: {
  pointsTextureSize: number;
  clustersTextureSize: number;
}): UniformStore<CalculateCentermassUniformStoreShape> {
  return new UniformStore({
    calculateCentermassUniforms: {
      uniformTypes: {
        pointsTextureSize: 'f32',
        clustersTextureSize: 'f32',
      },
      defaultUniforms: {
        pointsTextureSize: options.pointsTextureSize,
        clustersTextureSize: options.clustersTextureSize,
      },
    },
  })
}

export function createApplyForcesUniformStore (options: {
  alpha: number;
  clustersTextureSize: number;
  clusterCoefficient: number;
}): UniformStore<ApplyForcesUniformStoreShape> {
  return new UniformStore({
    applyForcesUniforms: {
      uniformTypes: {
        alpha: 'f32',
        clustersTextureSize: 'f32',
        clusterCoefficient: 'f32',
      },
      defaultUniforms: {
        alpha: options.alpha,
        clustersTextureSize: options.clustersTextureSize,
        clusterCoefficient: options.clusterCoefficient,
      },
    },
  })
}
