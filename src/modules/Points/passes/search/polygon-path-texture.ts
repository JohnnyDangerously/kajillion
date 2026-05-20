import type { Device, Texture } from '@luma.gl/core'

import { getBytesPerRow } from '@/graph/modules/Shared/texture-utils'
import { writeOrCreateTexture } from '@/graph/modules/Points/passes/resources/lifecycle'

export type PolygonPathTextureState = {
  texture: Texture | undefined;
  length: number;
}

export function updatePolygonPathTexture (
  device: Device,
  polygonPath: [number, number][],
  texture: Texture | undefined
): PolygonPathTextureState {
  if (polygonPath.length === 0) {
    if (texture && !texture.destroyed) texture.destroy()
    return { texture: undefined, length: 0 }
  }

  const textureSize = Math.ceil(Math.sqrt(polygonPath.length))
  const textureData = new Float32Array(textureSize * textureSize * 4)
  for (const [i, point] of polygonPath.entries()) {
    const [x, y] = point
    textureData[i * 4] = x
    textureData[i * 4 + 1] = y
  }

  return {
    length: polygonPath.length,
    texture: writeOrCreateTexture(device, texture, {
      width: textureSize,
      height: textureSize,
      format: 'rgba32float',
    }, {
      data: textureData,
      bytesPerRow: getBytesPerRow('rgba32float', textureSize),
      mipLevel: 0,
      x: 0,
      y: 0,
    }),
  }
}
