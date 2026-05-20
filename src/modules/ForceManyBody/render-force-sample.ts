import type { Device, Framebuffer, RenderPass, Texture, UniformStore } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import type { GraphConfigInterface } from '@/graph/config'
import type { Store } from '@/graph/modules/Store'

import { getLevelTextureSize } from './constants'
import type {
  ForceCenterUniformStoreShape,
  ForceUniformStoreShape,
  LevelTarget,
} from './contracts'

type RunForceSampleRenderPassOptions = {
  device: Device;
  store: Store;
  config: GraphConfigInterface;
  previousPositionTexture: Texture;
  velocityFbo: Framebuffer;
  levels: number;
  levelTargets: Map<number, LevelTarget>;
  forceCommand: Model;
  forceFromItsOwnCentermassCommand: Model;
  forceUniformStore: UniformStore<ForceUniformStoreShape>;
  forceCenterUniformStore: UniformStore<ForceCenterUniformStoreShape>;
  randomValuesTexture: Texture;
}

export function runForceSampleRenderPass (options: RunForceSampleRenderPassOptions): void {
  const drawPass = options.device.beginRenderPass({
    framebuffer: options.velocityFbo,
    clearColor: [0, 0, 0, 0],
  })

  for (let level = 0; level < options.levels; level += 1) {
    const target = options.levelTargets.get(level)
    if (!target || target.texture.destroyed) continue
    const levelTextureSize = getLevelTextureSize(level)

    drawForceLevel(options, drawPass, target, level, levelTextureSize)

    if (level === options.levels - 1) {
      drawForceCenter(options, drawPass, target, levelTextureSize)
    }
  }

  drawPass.end()
}

function drawForceLevel (
  options: RunForceSampleRenderPassOptions,
  drawPass: RenderPass,
  target: LevelTarget,
  level: number,
  levelTextureSize: number
): void {
  options.forceUniformStore.setUniforms({
    forceUniforms: {
      level,
      levels: options.levels,
      levelTextureSize,
      alpha: options.store.alpha,
      repulsion: options.config.simulationRepulsion,
      spaceSize: options.store.adjustedSpaceSize,
      theta: options.config.simulationRepulsionTheta,
    },
  })

  options.forceCommand.setBindings({
    positionsTexture: options.previousPositionTexture,
    levelFbo: target.texture,
  })

  options.forceCommand.draw(drawPass)
}

function drawForceCenter (
  options: RunForceSampleRenderPassOptions,
  drawPass: RenderPass,
  target: LevelTarget,
  levelTextureSize: number
): void {
  options.forceCenterUniformStore.setUniforms({
    forceCenterUniforms: {
      levelTextureSize,
      alpha: options.store.alpha,
      repulsion: options.config.simulationRepulsion,
    },
  })

  options.forceFromItsOwnCentermassCommand.setBindings({
    positionsTexture: options.previousPositionTexture,
    randomValues: options.randomValuesTexture,
    levelFbo: target.texture,
  })
  options.forceFromItsOwnCentermassCommand.draw(drawPass)
}
