import { Texture } from '@luma.gl/core'
import type { Device } from '@luma.gl/core'

import { getBytesPerRow } from '@/graph/modules/Shared/texture-utils'

import type { LevelTarget } from './contracts'

export function createLevelTarget (device: Device, levelTextureSize: number): LevelTarget {
  const texture = device.createTexture({
    width: levelTextureSize,
    height: levelTextureSize,
    format: 'rgba32float',
    usage: Texture.SAMPLE | Texture.RENDER | Texture.COPY_DST,
  })
  clearLevelTexture(texture, levelTextureSize)

  const fbo = device.createFramebuffer({
    width: levelTextureSize,
    height: levelTextureSize,
    colorAttachments: [texture],
  })

  return { texture, fbo }
}

export function clearLevelTarget (target: LevelTarget, levelTextureSize: number): void {
  clearLevelTexture(target.texture, levelTextureSize)
}

export function destroyLevelTarget (target: LevelTarget): void {
  if (!target.fbo.destroyed) target.fbo.destroy()
  if (!target.texture.destroyed) target.texture.destroy()
}

export function createRandomValuesState (
  pointsTextureSize: number,
  getRandomFloat: (min: number, max: number) => number
): Float32Array {
  const totalPixels = pointsTextureSize * pointsTextureSize
  const randomValuesState = new Float32Array(totalPixels * 4)
  for (let i = 0; i < totalPixels; ++i) {
    randomValuesState[i * 4] = getRandomFloat(-1, 1) * 0.00001
    randomValuesState[i * 4 + 1] = getRandomFloat(-1, 1) * 0.00001
  }
  return randomValuesState
}

export function needsTextureResize (
  texture: Texture | undefined,
  width: number,
  height: number
): boolean {
  return !texture || texture.destroyed || texture.width !== width || texture.height !== height
}

function clearLevelTexture (texture: Texture, levelTextureSize: number): void {
  texture.copyImageData({
    data: new Float32Array(levelTextureSize * levelTextureSize * 4).fill(0),
    bytesPerRow: getBytesPerRow('rgba32float', levelTextureSize),
    mipLevel: 0,
    x: 0,
    y: 0,
  })
}
