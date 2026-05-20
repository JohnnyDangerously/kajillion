import { Buffer, Texture } from '@luma.gl/core'
import type { ComputePipeline, Device, Shader } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'

import { createIndexesForBuffer } from '@/graph/modules/Shared/buffer'
import { getBytesPerRow } from '@/graph/modules/Shared/texture-utils'

import {
  getLevelCount,
  getLevelTextureSize,
} from './constants'
import type { LevelTarget } from './contracts'
import {
  clearLevelTarget,
  createLevelTarget,
  createRandomValuesState,
  destroyLevelTarget,
} from './resources'

export type PrepareForceManyBodyResourcesOptions = {
  device: Device;
  pointsTextureSize: number;
  adjustedSpaceSize: number;
  getRandomFloat: (min: number, max: number) => number;
  levelTargets: Map<number, LevelTarget>;
  randomValuesTexture: Texture | undefined;
  pointIndices: Buffer | undefined;
  previousPointsTextureSize: number | undefined;
  calculateLevelsCommand: Model | undefined;
  forceComputeCompiledLevels: number | undefined;
  forceComputePipeline: ComputePipeline | undefined;
  forceComputeShader: Shader | undefined;
}

export type PrepareForceManyBodyResourcesResult = {
  levels: number;
  randomValuesTexture: Texture;
  pointIndices: Buffer | undefined;
  forceComputePipeline: ComputePipeline | undefined;
  forceComputeShader: Shader | undefined;
  previousPointsTextureSize: number;
  previousSpaceSize: number;
}

export function prepareForceManyBodyResources (
  options: PrepareForceManyBodyResourcesOptions
): PrepareForceManyBodyResourcesResult {
  const levels = getLevelCount(options.adjustedSpaceSize)
  syncLevelTargets(options.device, options.levelTargets, levels)

  const randomValuesTexture = syncRandomValuesTexture(options)
  const pointIndices = syncPointIndices(options)
  const computeResources = syncCompiledComputeResources(options, levels)

  return {
    levels,
    randomValuesTexture,
    pointIndices,
    forceComputePipeline: computeResources.forceComputePipeline,
    forceComputeShader: computeResources.forceComputeShader,
    previousPointsTextureSize: options.pointsTextureSize,
    previousSpaceSize: options.adjustedSpaceSize,
  }
}

function syncLevelTargets (
  device: Device,
  levelTargets: Map<number, LevelTarget>,
  levels: number
): void {
  for (let level = 0; level < levels; level += 1) {
    const levelTextureSize = getLevelTextureSize(level)
    const existingTarget = levelTargets.get(level)

    if (
      existingTarget &&
      existingTarget.texture.width === levelTextureSize &&
      existingTarget.texture.height === levelTextureSize
    ) {
      clearLevelTarget(existingTarget, levelTextureSize)
      continue
    }

    if (existingTarget) {
      destroyLevelTarget(existingTarget)
    }

    levelTargets.set(level, createLevelTarget(device, levelTextureSize))
  }

  for (const [level, target] of Array.from(levelTargets.entries())) {
    if (level >= levels) {
      destroyLevelTarget(target)
      levelTargets.delete(level)
    }
  }
}

function syncRandomValuesTexture (
  options: PrepareForceManyBodyResourcesOptions
): Texture {
  const randomValuesState = createRandomValuesState(
    options.pointsTextureSize,
    options.getRandomFloat
  )
  let randomValuesTexture = options.randomValuesTexture

  if (
    !randomValuesTexture ||
    randomValuesTexture.destroyed ||
    randomValuesTexture.width !== options.pointsTextureSize ||
    randomValuesTexture.height !== options.pointsTextureSize
  ) {
    if (randomValuesTexture && !randomValuesTexture.destroyed) {
      randomValuesTexture.destroy()
    }
    randomValuesTexture = options.device.createTexture({
      width: options.pointsTextureSize,
      height: options.pointsTextureSize,
      format: 'rgba32float',
      usage: Texture.SAMPLE | Texture.COPY_DST,
    })
  }

  randomValuesTexture.copyImageData({
    data: randomValuesState,
    bytesPerRow: getBytesPerRow('rgba32float', options.pointsTextureSize),
    mipLevel: 0,
    x: 0,
    y: 0,
  })

  return randomValuesTexture
}

function syncPointIndices (
  options: PrepareForceManyBodyResourcesOptions
): Buffer | undefined {
  if (options.pointIndices && options.previousPointsTextureSize === options.pointsTextureSize) {
    return options.pointIndices
  }

  if (options.pointIndices && !options.pointIndices.destroyed) {
    options.pointIndices.destroy()
  }

  const pointIndices = options.device.createBuffer({
    data: createIndexesForBuffer(options.pointsTextureSize),
    usage: Buffer.VERTEX | Buffer.COPY_DST,
  })
  options.calculateLevelsCommand?.setAttributes({ pointIndices })
  return pointIndices
}

function syncCompiledComputeResources (
  options: PrepareForceManyBodyResourcesOptions,
  levels: number
): {
  forceComputePipeline: ComputePipeline | undefined;
  forceComputeShader: Shader | undefined;
} {
  let { forceComputePipeline, forceComputeShader } = options
  if (options.forceComputeCompiledLevels !== undefined && options.forceComputeCompiledLevels !== levels) {
    forceComputePipeline?.destroy()
    forceComputePipeline = undefined
    forceComputeShader?.destroy()
    forceComputeShader = undefined
  }
  return { forceComputePipeline, forceComputeShader }
}
