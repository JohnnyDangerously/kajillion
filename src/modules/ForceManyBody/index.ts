import type { Buffer, ComputePipeline, Shader, Texture, UniformStore } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import { CoreModule } from '@/graph/modules/core-module'

import type {
  CalculateLevelsUniformStoreShape,
  ForceCenterUniformStoreShape,
  ForceComputeUniformStoreShape,
  ForceUniformStoreShape,
  LevelTarget,
} from './contracts'
import { destroyForceManyBodyResources } from './destroy'
import { initForceManyBodyPrograms } from './init-programs'
import { prepareForceManyBodyResources } from './lifecycle'
import {
  runForceSamplePass,
  runQuadtreeBuildPass,
} from './run'

export class ForceManyBody extends CoreModule {
  private randomValuesTexture: Texture | undefined
  private pointIndices: Buffer | undefined
  private levels = 0
  private levelTargets = new Map<number, LevelTarget>()

  private calculateLevelsCommand: Model | undefined
  private forceCommand: Model | undefined
  private forceFromItsOwnCentermassCommand: Model | undefined

  private forceComputeShader: Shader | undefined
  private forceComputePipeline: ComputePipeline | undefined
  private forceComputeUniformStore: UniformStore<ForceComputeUniformStoreShape> | undefined

  private forceComputeUniformBuffer: Buffer | undefined
  private forceComputeCompiledLevels: number | undefined

  private forceVertexCoordBuffer: Buffer | undefined

  private calculateLevelsUniformStore: UniformStore<CalculateLevelsUniformStoreShape> | undefined

  private forceUniformStore: UniformStore<ForceUniformStoreShape> | undefined

  private forceCenterUniformStore: UniformStore<ForceCenterUniformStoreShape> | undefined

  private previousPointsTextureSize: number | undefined
  private previousSpaceSize: number | undefined

  public create (): void {
    const { store } = this
    if (!store.pointsTextureSize) return

    const resources = prepareForceManyBodyResources({
      device: this.device,
      pointsTextureSize: store.pointsTextureSize,
      adjustedSpaceSize: store.adjustedSpaceSize,
      getRandomFloat: (min, max) => store.getRandomFloat(min, max),
      levelTargets: this.levelTargets,
      randomValuesTexture: this.randomValuesTexture,
      pointIndices: this.pointIndices,
      previousPointsTextureSize: this.previousPointsTextureSize,
      calculateLevelsCommand: this.calculateLevelsCommand,
      forceComputeCompiledLevels: this.forceComputeCompiledLevels,
      forceComputePipeline: this.forceComputePipeline,
      forceComputeShader: this.forceComputeShader,
    })

    this.levels = resources.levels
    this.randomValuesTexture = resources.randomValuesTexture
    this.pointIndices = resources.pointIndices
    this.forceComputePipeline = resources.forceComputePipeline
    this.forceComputeShader = resources.forceComputeShader
    this.previousPointsTextureSize = resources.previousPointsTextureSize
    this.previousSpaceSize = resources.previousSpaceSize
  }

  public initPrograms (): void {
    Object.assign(this, initForceManyBodyPrograms({
      device: this.device,
      config: this.config,
      store: this.store,
      data: this.data,
      points: this.points,
      levels: this.levels,
      pointIndices: this.pointIndices,
      calculateLevelsCommand: this.calculateLevelsCommand,
      calculateLevelsUniformStore: this.calculateLevelsUniformStore,
      forceCommand: this.forceCommand,
      forceFromItsOwnCentermassCommand: this.forceFromItsOwnCentermassCommand,
      forceUniformStore: this.forceUniformStore,
      forceCenterUniformStore: this.forceCenterUniformStore,
      forceVertexCoordBuffer: this.forceVertexCoordBuffer,
      forceComputePipeline: this.forceComputePipeline,
      forceComputeUniformStore: this.forceComputeUniformStore,
      forceComputeUniformBuffer: this.forceComputeUniformBuffer,
    }))
  }

  public run (): void {
    if (!this.runQuadtreeBuild()) return
    this.runForceSample()
  }

  public runQuadtreeBuild (): boolean {
    return runQuadtreeBuildPass({
      device: this.device,
      config: this.config,
      store: this.store,
      data: this.data,
      points: this.points,
      levels: this.levels,
      levelTargets: this.levelTargets,
      calculateLevelsCommand: this.calculateLevelsCommand,
      calculateLevelsUniformStore: this.calculateLevelsUniformStore,
      pointIndices: this.pointIndices,
      previousPointsTextureSize: this.previousPointsTextureSize,
      previousSpaceSize: this.previousSpaceSize,
    })
  }

  public runForceSample (): void {
    runForceSamplePass({
      device: this.device,
      config: this.config,
      store: this.store,
      data: this.data,
      points: this.points,
      levels: this.levels,
      levelTargets: this.levelTargets,
      forceCommand: this.forceCommand,
      forceFromItsOwnCentermassCommand: this.forceFromItsOwnCentermassCommand,
      forceUniformStore: this.forceUniformStore,
      forceCenterUniformStore: this.forceCenterUniformStore,
      forceComputePipeline: this.forceComputePipeline,
      forceComputeUniformStore: this.forceComputeUniformStore,
      forceComputeUniformBuffer: this.forceComputeUniformBuffer,
      randomValuesTexture: this.randomValuesTexture,
    })
  }

  public destroy (): void {
    Object.assign(this, destroyForceManyBodyResources({
      calculateLevelsCommand: this.calculateLevelsCommand,
      forceCommand: this.forceCommand,
      forceFromItsOwnCentermassCommand: this.forceFromItsOwnCentermassCommand,
      forceComputePipeline: this.forceComputePipeline,
      forceComputeShader: this.forceComputeShader,
      levelTargets: this.levelTargets,
      randomValuesTexture: this.randomValuesTexture,
      calculateLevelsUniformStore: this.calculateLevelsUniformStore,
      forceUniformStore: this.forceUniformStore,
      forceCenterUniformStore: this.forceCenterUniformStore,
      forceComputeUniformStore: this.forceComputeUniformStore,
      pointIndices: this.pointIndices,
      forceVertexCoordBuffer: this.forceVertexCoordBuffer,
    }))
  }
}
