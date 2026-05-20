import type { Device, Framebuffer, Texture, UniformStore } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'

import type {
  CalculateCentermassUniformStoreShape,
  ForceCenterUniformStoreShape,
} from './contracts'

export function calculateCentermassPass (options: {
  device: Device;
  framebuffer: Framebuffer;
  pointsTextureSize: number;
  positionsTexture: Texture;
  uniformStore: UniformStore<CalculateCentermassUniformStoreShape>;
  command: Model;
}): void {
  const centermassPass = options.device.beginRenderPass({
    framebuffer: options.framebuffer,
    clearColor: [0, 0, 0, 0],
  })

  options.uniformStore.setUniforms({
    calculateCentermassUniforms: {
      pointsTextureSize: options.pointsTextureSize,
    },
  })
  options.command.setBindings({
    positionsTexture: options.positionsTexture,
  })

  options.command.draw(centermassPass)
  centermassPass.end()
}

export function applyForceCenterPass (options: {
  device: Device;
  framebuffer: Framebuffer;
  positionsTexture: Texture;
  centermassTexture: Texture;
  centerForce: number;
  alpha: number;
  uniformStore: UniformStore<ForceCenterUniformStoreShape>;
  command: Model;
}): void {
  options.uniformStore.setUniforms({
    forceCenterUniforms: {
      centerForce: options.centerForce,
      alpha: options.alpha,
    },
  })
  options.command.setBindings({
    positionsTexture: options.positionsTexture,
    centermassTexture: options.centermassTexture,
  })

  const pass = options.device.beginRenderPass({
    framebuffer: options.framebuffer,
    clearColor: [0, 0, 0, 0],
  })

  options.command.draw(pass)
  pass.end()
}
