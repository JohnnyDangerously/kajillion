import { UniformStore } from '@luma.gl/core'

import type {
  CalculateLevelsUniformStoreShape,
  ForceCenterUniformStoreShape,
  ForceComputeUniformStoreShape,
  ForceUniformStoreShape,
} from './contracts'

export function createCalculateLevelsUniformStore (
  pointsTextureSize: number
): UniformStore<CalculateLevelsUniformStoreShape> {
  return new UniformStore({
    calculateLevelsUniforms: {
      uniformTypes: {
        pointsTextureSize: 'f32',
        levelTextureSize: 'f32',
        cellSize: 'f32',
      },
      defaultUniforms: {
        pointsTextureSize,
        levelTextureSize: 0,
        cellSize: 0,
      },
    },
  })
}

export function createForceUniformStore (options: {
  levels: number;
  alpha: number;
  repulsion: number;
  spaceSize: number;
  theta: number;
}): UniformStore<ForceUniformStoreShape> {
  return new UniformStore({
    forceUniforms: {
      uniformTypes: {
        level: 'f32',
        levels: 'f32',
        levelTextureSize: 'f32',
        alpha: 'f32',
        repulsion: 'f32',
        spaceSize: 'f32',
        theta: 'f32',
      },
      defaultUniforms: {
        level: 0,
        levels: options.levels,
        levelTextureSize: 0,
        alpha: options.alpha,
        repulsion: options.repulsion,
        spaceSize: options.spaceSize,
        theta: options.theta,
      },
    },
  })
}

export function createForceCenterUniformStore (options: {
  alpha: number;
  repulsion: number;
}): UniformStore<ForceCenterUniformStoreShape> {
  return new UniformStore({
    forceCenterUniforms: {
      uniformTypes: {
        levelTextureSize: 'f32',
        alpha: 'f32',
        repulsion: 'f32',
      },
      defaultUniforms: {
        levelTextureSize: 0,
        alpha: options.alpha,
        repulsion: options.repulsion,
      },
    },
  })
}

export function createForceComputeUniformStore (): UniformStore<ForceComputeUniformStoreShape> {
  return new UniformStore({
    forceComputeUniforms: {
      uniformTypes: {
        levels: 'f32',
        alpha: 'f32',
        repulsion: 'f32',
        spaceSize: 'f32',
        theta: 'f32',
        pointsTextureSize: 'f32',
      },
    },
  })
}
