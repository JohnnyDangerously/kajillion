import type { Buffer, Device, Framebuffer, Texture, UniformStore } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'

import type {
  ApplyForcesUniformStoreShape,
  CalculateCentermassUniformStoreShape,
} from './contracts'

export function renderCalculateCentermass (options: {
  device: Device;
  command: Model | undefined;
  uniformStore: UniformStore<CalculateCentermassUniformStoreShape> | undefined;
  pointIndices: Buffer | undefined;
  framebuffer: Framebuffer | undefined;
  clusterTexture: Texture | undefined;
  positionsTexture: Texture | undefined;
  pointsNumber: number | undefined;
  pointsTextureSize: number;
  clustersTextureSize: number | undefined;
}): void {
  if (!options.command || !options.uniformStore || !options.pointIndices) return
  if (!options.framebuffer || options.framebuffer.destroyed) return
  if (!options.clusterTexture || options.clusterTexture.destroyed) return
  if (!options.positionsTexture || options.positionsTexture.destroyed) return

  options.command.setVertexCount(options.pointsNumber ?? 0)
  options.uniformStore.setUniforms({
    calculateCentermassUniforms: {
      pointsTextureSize: options.pointsTextureSize,
      clustersTextureSize: options.clustersTextureSize ?? 0,
    },
  })
  options.command.setBindings({
    clusterTexture: options.clusterTexture,
    positionsTexture: options.positionsTexture,
  })

  const centermassPass = options.device.beginRenderPass({
    framebuffer: options.framebuffer,
    clearColor: [0, 0, 0, 0],
  })
  options.command.draw(centermassPass)
  centermassPass.end()
}

export function renderApplyForces (options: {
  device: Device;
  command: Model | undefined;
  uniformStore: UniformStore<ApplyForcesUniformStoreShape> | undefined;
  clusterTexture: Texture | undefined;
  centermassTexture: Texture | undefined;
  clusterPositionsTexture: Texture | undefined;
  clusterForceCoefficientTexture: Texture | undefined;
  positionsTexture: Texture | undefined;
  velocityFbo: Framebuffer | undefined;
  alpha: number;
  clustersTextureSize: number | undefined;
  simulationCluster: number;
}): void {
  if (!options.command || !options.uniformStore) return
  if (!options.clusterTexture || options.clusterTexture.destroyed) return
  if (!options.centermassTexture || options.centermassTexture.destroyed) return
  if (!options.clusterPositionsTexture || options.clusterPositionsTexture.destroyed) return
  if (!options.clusterForceCoefficientTexture || options.clusterForceCoefficientTexture.destroyed) return
  if (!options.positionsTexture || options.positionsTexture.destroyed) return
  if (!options.velocityFbo || options.velocityFbo.destroyed) return

  options.uniformStore.setUniforms({
    applyForcesUniforms: {
      alpha: options.alpha,
      clustersTextureSize: options.clustersTextureSize ?? 0,
      clusterCoefficient: options.simulationCluster,
    },
  })
  options.command.setBindings({
    clusterTexture: options.clusterTexture,
    centermassTexture: options.centermassTexture,
    clusterPositionsTexture: options.clusterPositionsTexture,
    clusterForceCoefficient: options.clusterForceCoefficientTexture,
    positionsTexture: options.positionsTexture,
  })

  const pass = options.device.beginRenderPass({
    framebuffer: options.velocityFbo,
    clearColor: [0, 0, 0, 0],
  })
  options.command.draw(pass)
  pass.end()
}
