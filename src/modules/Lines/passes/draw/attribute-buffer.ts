import type { Buffer, Device } from '@luma.gl/core'

export type FloatAttributeBufferOptions = {
  device: Device;
  buffer: Buffer | undefined;
  data: Float32Array;
  itemCount: number;
  componentsPerItem: number;
  usage: number;
}

export function updateFloatAttributeBuffer ({
  device,
  buffer,
  data,
  itemCount,
  componentsPerItem,
  usage,
}: FloatAttributeBufferOptions): Buffer {
  if (!buffer) {
    return device.createBuffer({ data, usage })
  }

  const currentItemCount = (buffer.byteLength ?? 0) / (Float32Array.BYTES_PER_ELEMENT * componentsPerItem)
  if (currentItemCount !== itemCount) {
    if (!buffer.destroyed) buffer.destroy()
    return device.createBuffer({ data, usage })
  }

  buffer.write(data)
  return buffer
}
