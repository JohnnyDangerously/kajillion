import type { Device, Framebuffer, Texture } from '@luma.gl/core'
import { getBytesPerRow } from '@/graph/modules/Shared/texture-utils'
import { writeOrCreateTexture } from '@/graph/modules/Points/passes/resources/lifecycle'

export type TrackedPointTargetState = {
  trackedIndicesTexture: Texture | undefined;
  trackedPositionsFbo: Framebuffer | undefined;
}

export function ensureTrackedPointTargets (
  device: Device,
  indices: number[],
  pointsTextureSize: number,
  state: TrackedPointTargetState
): TrackedPointTargetState {
  const textureSize = Math.ceil(Math.sqrt(indices.length))
  const initialState = new Float32Array(textureSize * textureSize * 4).fill(-1)

  for (const [i, sortedIndex] of indices.entries()) {
    if (sortedIndex !== undefined) {
      initialState[i * 4] = sortedIndex % pointsTextureSize
      initialState[i * 4 + 1] = Math.floor(sortedIndex / pointsTextureSize)
      initialState[i * 4 + 2] = 0
      initialState[i * 4 + 3] = 0
    }
  }

  const trackedIndicesTexture = writeOrCreateTexture(device, state.trackedIndicesTexture, {
    width: textureSize,
    height: textureSize,
    format: 'rgba32float',
  }, {
    data: initialState,
    bytesPerRow: getBytesPerRow('rgba32float', textureSize),
    mipLevel: 0,
    x: 0,
    y: 0,
  })

  let { trackedPositionsFbo } = state
  if (!trackedPositionsFbo || trackedPositionsFbo.width !== textureSize || trackedPositionsFbo.height !== textureSize) {
    if (trackedPositionsFbo && !trackedPositionsFbo.destroyed) {
      trackedPositionsFbo.destroy()
    }
    trackedPositionsFbo = device.createFramebuffer({
      width: textureSize,
      height: textureSize,
      colorAttachments: ['rgba32float'],
    })
  }

  return {
    trackedIndicesTexture,
    trackedPositionsFbo,
  }
}
