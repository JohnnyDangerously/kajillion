import type { Buffer, ComputePipeline, Device, Texture, UniformStore } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import type { GraphConfigInterface } from '@/graph/config'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Points } from '@/graph/modules/Points'
import type { Store } from '@/graph/modules/Store'

import type {
  CalculateLevelsUniformStoreShape,
  ForceCenterUniformStoreShape,
  ForceComputeUniformStoreShape,
  ForceUniformStoreShape,
  LevelTarget,
} from './contracts'
import {
  drawForces,
  drawForcesCompute,
  drawLevels,
} from './render'

type ForceManyBodyRunContext = {
  device: Device;
  config: GraphConfigInterface;
  store: Store;
  data: GraphData;
  points: Points | undefined;
  levels: number;
  levelTargets: Map<number, LevelTarget>;
}

export type RunQuadtreeBuildOptions = ForceManyBodyRunContext & {
  previousPointsTextureSize: number | undefined;
  previousSpaceSize: number | undefined;
  calculateLevelsCommand: Model | undefined;
  calculateLevelsUniformStore: UniformStore<CalculateLevelsUniformStoreShape> | undefined;
  pointIndices: Buffer | undefined;
}

export type RunForceSampleOptions = ForceManyBodyRunContext & {
  forceCommand: Model | undefined;
  forceFromItsOwnCentermassCommand: Model | undefined;
  forceUniformStore: UniformStore<ForceUniformStoreShape> | undefined;
  forceCenterUniformStore: UniformStore<ForceCenterUniformStoreShape> | undefined;
  forceComputePipeline: ComputePipeline | undefined;
  forceComputeUniformStore: UniformStore<ForceComputeUniformStoreShape> | undefined;
  forceComputeUniformBuffer: Buffer | undefined;
  randomValuesTexture: Texture | undefined;
}

export function runQuadtreeBuildPass (options: RunQuadtreeBuildOptions): boolean {
  if (
    options.store.pointsTextureSize !== options.previousPointsTextureSize ||
    options.store.adjustedSpaceSize !== options.previousSpaceSize
  ) {
    return false
  }

  drawLevels(options)
  return true
}

export function runForceSamplePass (options: RunForceSampleOptions): void {
  if (options.forceComputePipeline) {
    drawForcesCompute(options)
  } else {
    drawForces(options)
  }
}
