import { Buffer, type Device } from '@luma.gl/core'

export interface VisibleLineBufferState {
  visibleLineIndexBuffer: Buffer | undefined;
  visibleLineIndirectBuffer: Buffer | undefined;
  visibleLineCapacity: number;
}

export function ensureVisibleLineBuffers (
  device: Device,
  state: VisibleLineBufferState,
  linkCount: number,
  vertexCount: number
): VisibleLineBufferState {
  if (
    state.visibleLineIndexBuffer &&
    state.visibleLineIndirectBuffer &&
    !state.visibleLineIndexBuffer.destroyed &&
    !state.visibleLineIndirectBuffer.destroyed &&
    state.visibleLineCapacity >= linkCount
  ) {
    return state
  }

  if (state.visibleLineIndexBuffer && !state.visibleLineIndexBuffer.destroyed) {
    state.visibleLineIndexBuffer.destroy()
  }
  if (state.visibleLineIndirectBuffer && !state.visibleLineIndirectBuffer.destroyed) {
    state.visibleLineIndirectBuffer.destroy()
  }

  return {
    visibleLineCapacity: linkCount,
    visibleLineIndexBuffer: device.createBuffer({
      byteLength: linkCount * Uint32Array.BYTES_PER_ELEMENT,
      usage: Buffer.STORAGE | Buffer.COPY_DST | Buffer.COPY_SRC,
    }),
    visibleLineIndirectBuffer: device.createBuffer({
      data: new Uint32Array([vertexCount || 4, 0, 0, 0]),
      usage: Buffer.STORAGE | Buffer.INDIRECT | Buffer.COPY_DST | Buffer.COPY_SRC,
    }),
  }
}
