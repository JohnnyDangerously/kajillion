import { Buffer, type Device } from '@luma.gl/core'
import { destroyResource } from '@/graph/modules/Points/passes/resources/lifecycle'
import type {
  VisiblePointBufferLifecycleState,
  VisiblePointBufferLayout,
  VisiblePointBufferSet,
  VisiblePointTileBudgetBufferState,
} from './contracts'

export function getVisiblePointBufferLayout (pointCount: number): VisiblePointBufferLayout {
  const groupCount = Math.max(1, Math.ceil(pointCount / 64))
  const blockCount = Math.max(1, Math.ceil(groupCount / 256))

  return {
    pointCapacity: pointCount,
    groupCount,
    blockCount,
  }
}

export function ensureVisiblePointBuffers (
  device: Device,
  state: VisiblePointBufferLifecycleState,
  pointCount: number,
): VisiblePointBufferLifecycleState {
  const layout = getVisiblePointBufferLayout(pointCount)
  if (isVisiblePointBufferStateCurrent(state, layout)) return state

  destroyVisiblePointBuffers(state)

  return {
    visiblePointCapacity: layout.pointCapacity,
    visiblePointGroupCapacity: layout.groupCount,
    visiblePointBlockCapacity: layout.blockCount,
    visiblePointIndexBuffer: device.createBuffer({
      byteLength: layout.pointCapacity * Uint32Array.BYTES_PER_ELEMENT,
      usage: Buffer.STORAGE | Buffer.COPY_DST | Buffer.COPY_SRC,
    }),
    visiblePointIndirectBuffer: device.createBuffer({
      data: new Uint32Array([4, 0, 0, 0]),
      usage: Buffer.STORAGE | Buffer.INDIRECT | Buffer.COPY_DST | Buffer.COPY_SRC,
    }),
    visiblePointGroupOffsetBuffer: device.createBuffer({
      byteLength: layout.groupCount * Uint32Array.BYTES_PER_ELEMENT,
      usage: Buffer.STORAGE | Buffer.COPY_DST | Buffer.COPY_SRC,
    }),
    visiblePointMaskBuffer: device.createBuffer({
      byteLength: layout.pointCapacity * Uint32Array.BYTES_PER_ELEMENT,
      usage: Buffer.STORAGE | Buffer.COPY_DST | Buffer.COPY_SRC,
    }),
    visiblePointBlockSumBuffer: device.createBuffer({
      byteLength: layout.blockCount * Uint32Array.BYTES_PER_ELEMENT,
      usage: Buffer.STORAGE | Buffer.COPY_DST | Buffer.COPY_SRC,
    }),
    visiblePointBlockOffsetBuffer: device.createBuffer({
      byteLength: layout.blockCount * Uint32Array.BYTES_PER_ELEMENT,
      usage: Buffer.STORAGE | Buffer.COPY_DST | Buffer.COPY_SRC,
    }),
  }
}

export function destroyVisiblePointBuffers (
  buffers: VisiblePointBufferSet,
): VisiblePointBufferSet {
  return {
    visiblePointIndexBuffer: destroyResource(buffers.visiblePointIndexBuffer),
    visiblePointIndirectBuffer: destroyResource(buffers.visiblePointIndirectBuffer),
    visiblePointGroupOffsetBuffer: destroyResource(buffers.visiblePointGroupOffsetBuffer),
    visiblePointMaskBuffer: destroyResource(buffers.visiblePointMaskBuffer),
    visiblePointBlockSumBuffer: destroyResource(buffers.visiblePointBlockSumBuffer),
    visiblePointBlockOffsetBuffer: destroyResource(buffers.visiblePointBlockOffsetBuffer),
  }
}

export function ensureVisiblePointTileBudgetBuffer (
  device: Device,
  state: VisiblePointTileBudgetBufferState,
  capacity: number,
): VisiblePointTileBudgetBufferState {
  const nextCapacity = Math.max(1, capacity)
  const currentBuffer = state.visiblePointTileBudgetBuffer

  if (
    currentBuffer &&
    !currentBuffer.destroyed &&
    state.visiblePointTileBudgetCapacity >= nextCapacity
  ) {
    return state
  }

  destroyResource(currentBuffer)

  return {
    visiblePointTileBudgetCapacity: nextCapacity,
    visiblePointTileBudgetBuffer: device.createBuffer({
      byteLength: nextCapacity * Uint32Array.BYTES_PER_ELEMENT,
      usage: Buffer.STORAGE | Buffer.COPY_DST | Buffer.COPY_SRC,
    }),
  }
}

function isVisiblePointBufferStateCurrent (
  state: VisiblePointBufferLifecycleState,
  layout: VisiblePointBufferLayout,
): boolean {
  return (
    hasLiveVisiblePointBuffers(state) &&
    state.visiblePointCapacity >= layout.pointCapacity &&
    state.visiblePointGroupCapacity === layout.groupCount &&
    state.visiblePointBlockCapacity === layout.blockCount
  )
}

function hasLiveVisiblePointBuffers (buffers: VisiblePointBufferSet): boolean {
  return (
    !!buffers.visiblePointIndexBuffer &&
    !!buffers.visiblePointIndirectBuffer &&
    !!buffers.visiblePointGroupOffsetBuffer &&
    !!buffers.visiblePointMaskBuffer &&
    !!buffers.visiblePointBlockSumBuffer &&
    !!buffers.visiblePointBlockOffsetBuffer &&
    !buffers.visiblePointIndexBuffer.destroyed &&
    !buffers.visiblePointIndirectBuffer.destroyed &&
    !buffers.visiblePointGroupOffsetBuffer.destroyed &&
    !buffers.visiblePointMaskBuffer.destroyed &&
    !buffers.visiblePointBlockSumBuffer.destroyed &&
    !buffers.visiblePointBlockOffsetBuffer.destroyed
  )
}
