import { Buffer, type Device } from '@luma.gl/core'
import { TILE_ATOMIC_LANES } from '@/graph/modules/Points/passes/shared/constants'

export type TileImpostorBufferState = {
  tileAtomicBuffer: Buffer | undefined;
  tileResolvedBuffer: Buffer | undefined;
  tileColumns: number;
  tileRows: number;
  tileCount: number;
  impostorBuildSignature: string;
}

export type HybridAnchorBufferState = {
  hybridAnchorCountBuffer: Buffer | undefined;
  hybridAnchorPositionBuffer: Buffer | undefined;
  hybridAnchorColorBuffer: Buffer | undefined;
  hybridAnchorIndirectBuffer: Buffer | undefined;
  hybridAnchorCapacity: number;
  impostorBuildSignature: string;
}

export function ensureTileImpostorBuffers (
  device: Device,
  state: TileImpostorBufferState,
  options: {
    screenSize: [number, number] | undefined;
    ratio: number;
    tileSize: number;
  },
): TileImpostorBufferState {
  const width = Math.max(1, Math.ceil((options.screenSize?.[0] ?? 1) * options.ratio))
  const height = Math.max(1, Math.ceil((options.screenSize?.[1] ?? 1) * options.ratio))
  const tileColumns = Math.max(1, Math.ceil(width / options.tileSize))
  const tileRows = Math.max(1, Math.ceil(height / options.tileSize))
  const tileCount = tileColumns * tileRows

  if (
    state.tileAtomicBuffer &&
    state.tileResolvedBuffer &&
    !state.tileAtomicBuffer.destroyed &&
    !state.tileResolvedBuffer.destroyed &&
    state.tileColumns === tileColumns &&
    state.tileRows === tileRows &&
    state.tileCount === tileCount
  ) {
    return state
  }

  destroyBuffer(state.tileAtomicBuffer)
  destroyBuffer(state.tileResolvedBuffer)

  return {
    tileColumns,
    tileRows,
    tileCount,
    tileAtomicBuffer: device.createBuffer({
      byteLength: tileCount * TILE_ATOMIC_LANES * 9 * Uint32Array.BYTES_PER_ELEMENT,
      usage: Buffer.STORAGE | Buffer.COPY_DST,
    }),
    tileResolvedBuffer: device.createBuffer({
      byteLength: tileCount * 3 * 4 * Float32Array.BYTES_PER_ELEMENT,
      usage: Buffer.STORAGE | Buffer.COPY_DST,
    }),
    impostorBuildSignature: '',
  }
}

export function ensureHybridAnchorBuffers (
  device: Device,
  state: HybridAnchorBufferState,
  options: {
    tileCount: number;
    anchorsPerTile: number;
  },
): HybridAnchorBufferState {
  if (options.tileCount === 0) return state
  const capacity = options.tileCount * options.anchorsPerTile
  if (
    state.hybridAnchorCountBuffer &&
    state.hybridAnchorPositionBuffer &&
    state.hybridAnchorColorBuffer &&
    state.hybridAnchorIndirectBuffer &&
    !state.hybridAnchorCountBuffer.destroyed &&
    !state.hybridAnchorPositionBuffer.destroyed &&
    !state.hybridAnchorColorBuffer.destroyed &&
    !state.hybridAnchorIndirectBuffer.destroyed &&
    state.hybridAnchorCapacity === capacity
  ) {
    return state
  }

  destroyBuffer(state.hybridAnchorCountBuffer)
  destroyBuffer(state.hybridAnchorPositionBuffer)
  destroyBuffer(state.hybridAnchorColorBuffer)
  destroyBuffer(state.hybridAnchorIndirectBuffer)

  return {
    hybridAnchorCapacity: capacity,
    hybridAnchorCountBuffer: device.createBuffer({
      byteLength: capacity * 2 * Uint32Array.BYTES_PER_ELEMENT,
      usage: Buffer.STORAGE | Buffer.COPY_DST,
    }),
    hybridAnchorPositionBuffer: device.createBuffer({
      byteLength: capacity * 4 * Float32Array.BYTES_PER_ELEMENT,
      usage: Buffer.STORAGE | Buffer.COPY_DST,
    }),
    hybridAnchorColorBuffer: device.createBuffer({
      byteLength: capacity * 4 * Float32Array.BYTES_PER_ELEMENT,
      usage: Buffer.STORAGE | Buffer.COPY_DST,
    }),
    hybridAnchorIndirectBuffer: device.createBuffer({
      data: new Uint32Array([4, 0, 0, 0]),
      usage: Buffer.STORAGE | Buffer.INDIRECT | Buffer.COPY_DST | Buffer.COPY_SRC,
    }),
    impostorBuildSignature: '',
  }
}

function destroyBuffer (buffer: Buffer | undefined): void {
  if (buffer && !buffer.destroyed) buffer.destroy()
}
