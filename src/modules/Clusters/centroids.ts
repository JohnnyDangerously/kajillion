import type { Device, Framebuffer } from '@luma.gl/core'

import { readPixels } from '@/graph/helper'

export function readCentroidPositions (options: {
  device: Device;
  framebuffer: Framebuffer;
  clusterCount: number;
}): number[] {
  const pixels = readPixels(options.device, options.framebuffer)
  const positions: number[] = []
  positions.length = options.clusterCount * 2

  for (let i = 0; i < positions.length / 2; i += 1) {
    const sumX = pixels[i * 4 + 0]
    const sumY = pixels[i * 4 + 1]
    const sumN = pixels[i * 4 + 2]
    if (sumX !== undefined && sumY !== undefined && sumN !== undefined) {
      positions[i * 2] = sumX / sumN
      positions[i * 2 + 1] = sumY / sumN
    }
  }

  return positions
}
