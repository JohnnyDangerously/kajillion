import type { Buffer, Device } from '@luma.gl/core'
import type { WebGpuBufferAccess } from '@/graph/modules/Points/passes/shared/contracts'

export type CapturePreviousPositionsOptions = {
  device: Device | undefined;
  positionStorageBuffer: Buffer | undefined;
  previousRenderPositionStorageBuffer: Buffer | undefined;
}

export type ReadbackPointPositionsOptions = {
  device: Device | undefined;
  positionStorageBuffer: Buffer | undefined;
  textureSize: number;
  pointCount: number;
  isPositionStorageBufferDirty: boolean;
  syncPositionStorageBuffer: () => boolean;
}

export function capturePreviousPositionBuffer (options: CapturePreviousPositionsOptions): boolean {
  const { device, positionStorageBuffer, previousRenderPositionStorageBuffer } = options
  if (!device || device.info?.type !== 'webgpu') return false
  if (!positionStorageBuffer || positionStorageBuffer.destroyed) return false
  if (!previousRenderPositionStorageBuffer || previousRenderPositionStorageBuffer.destroyed) return false
  const source = (positionStorageBuffer as unknown as WebGpuBufferAccess).handle
  const destination = (previousRenderPositionStorageBuffer as unknown as WebGpuBufferAccess).handle
  const encoder = (device as unknown as { commandEncoder?: { handle?: GPUCommandEncoder } }).commandEncoder?.handle
  if (!source || !destination || !encoder) return false
  encoder.copyBufferToBuffer(source, 0, destination, 0, positionStorageBuffer.byteLength)
  return true
}

export async function readbackPointPositionBuffer (
  options: ReadbackPointPositionsOptions
): Promise<Float32Array> {
  const { device, positionStorageBuffer, textureSize, pointCount } = options
  if (!device || device.info?.type !== 'webgpu') return new Float32Array(0)
  if (!positionStorageBuffer || positionStorageBuffer.destroyed) return new Float32Array(0)
  if (textureSize === 0) return new Float32Array(0)

  if (options.isPositionStorageBufferDirty) options.syncPositionStorageBuffer()
  device.submit()
  const raw = await positionStorageBuffer.readAsync()
  const interleaved = new Float32Array(
    raw.buffer,
    raw.byteOffset,
    raw.byteLength / Float32Array.BYTES_PER_ELEMENT
  )
  const n = pointCount || textureSize * textureSize
  const xy = new Float32Array(n * 2)
  for (let i = 0; i < n; i += 1) {
    xy[i * 2] = interleaved[i * 4] ?? 0
    xy[i * 2 + 1] = interleaved[i * 4 + 1] ?? 0
  }
  return xy
}
