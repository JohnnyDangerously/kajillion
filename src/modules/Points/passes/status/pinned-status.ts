import type { Device, Texture } from '@luma.gl/core'
import type { GraphData } from '@/graph/modules/GraphData'
import { getBytesPerRow } from '@/graph/modules/Shared/texture-utils'
import { writeOrCreateTexture } from '@/graph/modules/Points/passes/resources/lifecycle'

export function updatePinnedStatusTexture (
  device: Device,
  data: GraphData,
  pointsTextureSize: number,
  pinnedStatusTexture: Texture | undefined
): Texture | undefined {
  if (!pointsTextureSize) return pinnedStatusTexture

  const initialState = new Float32Array(pointsTextureSize * pointsTextureSize * 4).fill(0)

  if (data.inputPinnedPoints && data.pointsNumber !== undefined) {
    for (const pinnedIndex of data.inputPinnedPoints) {
      if (pinnedIndex >= 0 && pinnedIndex < data.pointsNumber) {
        initialState[pinnedIndex * 4] = 1
      }
    }
  }

  return writeOrCreateTexture(device, pinnedStatusTexture, {
    width: pointsTextureSize,
    height: pointsTextureSize,
    format: 'rgba32float',
  }, {
    data: initialState,
    bytesPerRow: getBytesPerRow('rgba32float', pointsTextureSize),
    mipLevel: 0,
    x: 0,
    y: 0,
  })
}
