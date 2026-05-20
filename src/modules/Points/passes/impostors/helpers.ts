import type { Buffer } from '@luma.gl/core'

export function isLiveBuffer (buffer: Buffer | undefined): buffer is Buffer {
  return !!buffer && !buffer.destroyed
}
