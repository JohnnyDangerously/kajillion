import { Texture, type Device, type Framebuffer } from '@luma.gl/core'
import { getBytesPerRow } from '@/graph/modules/Shared/texture-utils'
import { destroyResource } from '@/graph/modules/Points/passes/resources/lifecycle'

export type PositionTargetState = {
  texture: Texture | undefined;
  framebuffer: Framebuffer | undefined;
}

export function ensureRgba32FloatTarget (
  device: Device,
  state: PositionTargetState,
  pointsTextureSize: number,
  data: Float32Array,
  usage: number,
): PositionTargetState {
  const copyPayload = {
    data,
    bytesPerRow: getBytesPerRow('rgba32float', pointsTextureSize),
    mipLevel: 0,
    x: 0,
    y: 0,
  }
  const texture = state.texture

  if (texture && !texture.destroyed && texture.width === pointsTextureSize && texture.height === pointsTextureSize) {
    texture.copyImageData(copyPayload)
    return state
  }

  destroyResource(texture)
  destroyResource(state.framebuffer)

  const nextTexture = device.createTexture({
    width: pointsTextureSize,
    height: pointsTextureSize,
    format: 'rgba32float',
    usage,
  })
  nextTexture.copyImageData(copyPayload)

  return {
    texture: nextTexture,
    framebuffer: device.createFramebuffer({
      width: pointsTextureSize,
      height: pointsTextureSize,
      colorAttachments: [nextTexture],
    }),
  }
}
