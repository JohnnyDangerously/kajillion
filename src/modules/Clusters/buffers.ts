import { Buffer } from '@luma.gl/core'
import type { Device } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'

import { createIndexesForBuffer } from '@/graph/modules/Shared/buffer'

export function createOrUpdatePointIndices (options: {
  device: Device;
  pointIndices: Buffer | undefined;
  pointsTextureSize: number;
  previousPointsTextureSize: number | undefined;
  calculateCentermassCommand: Model | undefined;
}): Buffer {
  if (options.pointIndices && options.previousPointsTextureSize === options.pointsTextureSize) {
    return options.pointIndices
  }

  if (options.pointIndices && !options.pointIndices.destroyed) {
    options.pointIndices.destroy()
  }

  const pointIndices = options.device.createBuffer({
    data: createIndexesForBuffer(options.pointsTextureSize),
    usage: Buffer.VERTEX | Buffer.COPY_DST,
  })

  options.calculateCentermassCommand?.setAttributes({ pointIndices })
  return pointIndices
}

export function destroyBufferIfAlive (buffer: Buffer | undefined): void {
  if (buffer && !buffer.destroyed) {
    buffer.destroy()
  }
}
