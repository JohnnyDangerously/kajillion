import type { Binding, Buffer, ComputePipeline, Device, Texture, UniformStore } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import type { GraphConfigInterface } from '@/graph/config'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Points } from '@/graph/modules/Points'
import type { Store } from '@/graph/modules/Store'

import { FORCE_WORKGROUP_SIZE_X, FORCE_WORKGROUP_SIZE_Y, getLevelTextureSize } from './constants'
import type {
  CalculateLevelsUniformStoreShape,
  ForceCenterUniformStoreShape,
  ForceComputeUniformStoreShape,
  ForceUniformStoreShape,
  LevelTarget,
} from './contracts'
import { runForceSampleRenderPass } from './render-force-sample'

type ForceRenderContext = {
  device: Device;
  config: GraphConfigInterface;
  store: Store;
  data: GraphData;
  points: Points | undefined;
  levels: number;
  levelTargets: Map<number, LevelTarget>;
}

export type DrawLevelsOptions = ForceRenderContext & {
  calculateLevelsCommand: Model | undefined;
  calculateLevelsUniformStore: UniformStore<CalculateLevelsUniformStoreShape> | undefined;
  pointIndices: Buffer | undefined;
}

export type DrawForcesOptions = ForceRenderContext & {
  forceCommand: Model | undefined;
  forceFromItsOwnCentermassCommand: Model | undefined;
  forceUniformStore: UniformStore<ForceUniformStoreShape> | undefined;
  forceCenterUniformStore: UniformStore<ForceCenterUniformStoreShape> | undefined;
  randomValuesTexture: Texture | undefined;
}

export type DrawForcesComputeOptions = ForceRenderContext & {
  forceComputePipeline: ComputePipeline | undefined;
  forceComputeUniformStore: UniformStore<ForceComputeUniformStoreShape> | undefined;
  forceComputeUniformBuffer: Buffer | undefined;
  randomValuesTexture: Texture | undefined;
}

export function drawLevels (options: DrawLevelsOptions): void {
  const {
    device,
    store,
    data,
    points,
    levels,
    levelTargets,
    calculateLevelsCommand,
    calculateLevelsUniformStore,
    pointIndices,
  } = options
  if (!points) return
  if (!calculateLevelsCommand || !calculateLevelsUniformStore) return
  if (!points.previousPositionTexture || points.previousPositionTexture.destroyed) return
  if (!data.pointsNumber) return
  if (!pointIndices) return

  for (let level = 0; level < levels; level += 1) {
    const target = levelTargets.get(level)
    if (!target || target.fbo.destroyed || target.texture.destroyed) continue

    const levelTextureSize = getLevelTextureSize(level)
    const cellSize = store.adjustedSpaceSize / levelTextureSize

    calculateLevelsUniformStore.setUniforms({
      calculateLevelsUniforms: {
        pointsTextureSize: store.pointsTextureSize ?? 0,
        levelTextureSize,
        cellSize,
      },
    })

    calculateLevelsCommand.setVertexCount(data.pointsNumber)
    calculateLevelsCommand.setBindings({
      positionsTexture: points.previousPositionTexture,
    })

    const levelPass = device.beginRenderPass({
      framebuffer: target.fbo,
      clearColor: [0, 0, 0, 0],
    })

    calculateLevelsCommand.draw(levelPass)

    levelPass.end()
  }
}

export function drawForces (options: DrawForcesOptions): void {
  const {
    device,
    store,
    config,
    points,
    levels,
    levelTargets,
    forceCommand,
    forceFromItsOwnCentermassCommand,
    forceUniformStore,
    forceCenterUniformStore,
    randomValuesTexture,
  } = options
  if (!points) return
  if (!forceCommand || !forceUniformStore) return
  if (!forceFromItsOwnCentermassCommand || !forceCenterUniformStore) return
  if (!points.previousPositionTexture || points.previousPositionTexture.destroyed) return
  if (!randomValuesTexture || randomValuesTexture.destroyed) return
  if (!points.velocityFbo || points.velocityFbo.destroyed) return

  const { previousPositionTexture, velocityFbo } = points
  runForceSampleRenderPass({
    device,
    store,
    config,
    previousPositionTexture,
    velocityFbo,
    levels,
    levelTargets,
    forceCommand,
    forceFromItsOwnCentermassCommand,
    forceUniformStore,
    forceCenterUniformStore,
    randomValuesTexture,
  })
}

export function drawForcesCompute (options: DrawForcesComputeOptions): void {
  const {
    device,
    store,
    config,
    points,
    levels,
    levelTargets,
    forceComputePipeline,
    forceComputeUniformStore,
    forceComputeUniformBuffer,
    randomValuesTexture,
  } = options
  if (!points) return
  if (!forceComputePipeline || !forceComputeUniformStore || !forceComputeUniformBuffer) return
  if (!points.previousPositionTexture || points.previousPositionTexture.destroyed) return
  if (!points.velocityTexture || points.velocityTexture.destroyed) return
  if (!randomValuesTexture || randomValuesTexture.destroyed) return
  if (levels <= 0) return

  forceComputeUniformStore.setUniforms({
    forceComputeUniforms: {
      levels,
      alpha: store.alpha,
      repulsion: config.simulationRepulsion,
      spaceSize: store.adjustedSpaceSize,
      theta: config.simulationRepulsionTheta,
      pointsTextureSize: store.pointsTextureSize ?? 0,
    },
  })

  const bindings: Record<string, Binding> = {
    forceComputeUniforms: forceComputeUniformBuffer,
    positionsTexture: points.previousPositionTexture,
    randomValues: randomValuesTexture,
    velocityOut: points.velocityTexture,
  }
  for (let i = 0; i < levels; i += 1) {
    const target = levelTargets.get(i)
    if (!target || target.texture.destroyed) return
    bindings[`levelFbo${i}`] = target.texture
  }
  forceComputePipeline.setBindings(bindings)

  const size = store.pointsTextureSize ?? 0
  if (size === 0) return
  const groupsX = Math.ceil(size / FORCE_WORKGROUP_SIZE_X)
  const groupsY = Math.ceil(size / FORCE_WORKGROUP_SIZE_Y)

  const pass = device.beginComputePass({ id: 'force.many-body.compute' })
  pass.setPipeline(forceComputePipeline)
  pass.dispatch(groupsX, groupsY, 1)
  pass.end()
}
