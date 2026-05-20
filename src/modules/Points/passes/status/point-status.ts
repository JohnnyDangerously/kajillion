import { Buffer as LumaBuffer, type Device, type Texture } from '@luma.gl/core'
import type { GraphConfigInterface } from '@/graph/config'
import type { GraphData } from '@/graph/modules/GraphData'
import { getBytesPerRow } from '@/graph/modules/Shared/texture-utils'
import { writeOrCreateTexture } from '@/graph/modules/Points/passes/resources/lifecycle'

export type PointStatusState = {
  pointStatusTexture: Texture | undefined;
  pointStatusStorageBuffer: LumaBuffer | undefined;
}

export function updatePointStatusState (
  device: Device,
  config: GraphConfigInterface,
  data: GraphData,
  pointsTextureSize: number,
  state: PointStatusState
): PointStatusState {
  if (!pointsTextureSize || data.pointsNumber === undefined) return state

  const { highlightedPointIndices, outlinedPointIndices } = config
  const hasHighlighting = highlightedPointIndices !== undefined
  const hasOutlining = outlinedPointIndices !== undefined

  // R = greyout, G = outlined. Texture path remains for search/hover shaders;
  // WebGPU draw also mirrors this state into a storage buffer.
  const statusData = new Float32Array(pointsTextureSize * pointsTextureSize * 4)

  if (hasHighlighting) {
    for (let i = 0; i < statusData.length; i += 4) statusData[i] = 1
    for (const idx of highlightedPointIndices) {
      if (idx >= 0 && idx < data.pointsNumber) statusData[idx * 4] = 0
    }
  }

  if (hasOutlining) {
    for (const idx of outlinedPointIndices) {
      if (idx >= 0 && idx < data.pointsNumber) statusData[idx * 4 + 1] = 1
    }
  }

  const pointStatusTexture = writeOrCreateTexture(device, state.pointStatusTexture, {
    width: pointsTextureSize,
    height: pointsTextureSize,
    format: 'rgba32float',
  }, {
    data: statusData,
    bytesPerRow: getBytesPerRow('rgba32float', pointsTextureSize),
    mipLevel: 0,
    x: 0,
    y: 0,
  })

  let { pointStatusStorageBuffer } = state
  if (device.info?.type === 'webgpu') {
    const expectedBytes = statusData.byteLength
    if (!pointStatusStorageBuffer || pointStatusStorageBuffer.destroyed || pointStatusStorageBuffer.byteLength !== expectedBytes) {
      if (pointStatusStorageBuffer && !pointStatusStorageBuffer.destroyed) {
        pointStatusStorageBuffer.destroy()
      }
      pointStatusStorageBuffer = device.createBuffer({
        byteLength: expectedBytes,
        usage: LumaBuffer.STORAGE | LumaBuffer.COPY_DST,
      })
    }
    pointStatusStorageBuffer.write(new Uint8Array(statusData.buffer, statusData.byteOffset, statusData.byteLength))
  }

  return {
    pointStatusTexture,
    pointStatusStorageBuffer,
  }
}
