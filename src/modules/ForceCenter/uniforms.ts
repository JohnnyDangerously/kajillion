import { UniformStore } from '@luma.gl/core'

import type {
  CalculateCentermassUniformStoreShape,
  ForceCenterUniformStoreShape,
} from './contracts'

export function createCalculateCentermassUniformStore (): UniformStore<CalculateCentermassUniformStoreShape> {
  return new UniformStore({
    calculateCentermassUniforms: {
      uniformTypes: {
        pointsTextureSize: 'f32',
      },
    },
  })
}

export function createForceCenterUniformStore (): UniformStore<ForceCenterUniformStoreShape> {
  return new UniformStore({
    forceCenterUniforms: {
      uniformTypes: {
        centerForce: 'f32',
        alpha: 'f32',
      },
    },
  })
}
