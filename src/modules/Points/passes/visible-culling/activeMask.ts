import { Buffer, type Device } from '@luma.gl/core'

export type ActivePointMaskLayout = {
  activePointIndices: readonly number[] | undefined;
  hasActiveFilter: boolean;
  pointCount: number;
  requiredCapacity: number;
  expectedBytes: number;
}

export type ActivePointMaskCacheState = {
  dirty: boolean;
  signature: string;
  pointCount: number;
  capacity: number;
  indicesRef: readonly number[] | undefined;
  hasLiveBuffer: boolean;
}

export type ActivePointMaskState = {
  buffer: Buffer | undefined;
  capacity: number;
  signature: string;
  pointCount: number;
  dirty: boolean;
  indicesRef: readonly number[] | undefined;
}

export function getActivePointMaskLayout ({
  activePointIndices,
  pointCount,
}: {
  activePointIndices: readonly number[] | undefined;
  pointCount: number;
}): ActivePointMaskLayout {
  const hasActiveFilter = activePointIndices !== undefined
  const requiredCapacity = hasActiveFilter ? pointCount : 1

  return {
    activePointIndices,
    hasActiveFilter,
    pointCount,
    requiredCapacity,
    expectedBytes: requiredCapacity * Uint32Array.BYTES_PER_ELEMENT,
  }
}

export function isActivePointMaskCurrentByReference (
  cache: ActivePointMaskCacheState,
  layout: ActivePointMaskLayout,
): boolean {
  return (
    !cache.dirty &&
    cache.indicesRef === layout.activePointIndices &&
    isActivePointMaskCacheCurrent(cache, layout)
  )
}

export function isActivePointMaskCurrentBySignature (
  cache: ActivePointMaskCacheState,
  layout: ActivePointMaskLayout,
  signature: string,
): boolean {
  return (
    !cache.dirty &&
    cache.signature === signature &&
    isActivePointMaskCacheCurrent(cache, layout)
  )
}

export function shouldRecreateActivePointMaskBuffer (
  cache: ActivePointMaskCacheState,
  layout: ActivePointMaskLayout,
): boolean {
  return (
    !cache.hasLiveBuffer ||
    (layout.hasActiveFilter
      ? cache.capacity < layout.pointCount
      : cache.capacity !== 1)
  )
}

export function getActivePointMaskSignature (layout: ActivePointMaskLayout): string {
  return layout.hasActiveFilter && layout.activePointIndices
    ? `filter:${layout.pointCount}:${layout.activePointIndices.length}:${hashActivePointIndices(layout.activePointIndices)}`
    : 'all'
}

export function createActivePointMaskData (layout: ActivePointMaskLayout): Uint32Array {
  const mask = new Uint32Array(layout.requiredCapacity)
  if (!layout.hasActiveFilter) {
    mask[0] = 1
    return mask
  }

  const activePointIndices = layout.activePointIndices
  if (!activePointIndices) return mask

  for (const index of activePointIndices) {
    if (index >= 0 && index < layout.pointCount) mask[index] = 1
  }
  return mask
}

export function updateActivePointMask (
  device: Device,
  state: ActivePointMaskState,
  options: {
    activePointIndices: readonly number[] | undefined;
    pointCount: number;
  },
): ActivePointMaskState {
  const layout = getActivePointMaskLayout(options)
  const cacheState: ActivePointMaskCacheState = {
    dirty: state.dirty,
    signature: state.signature,
    pointCount: state.pointCount,
    capacity: state.capacity,
    indicesRef: state.indicesRef,
    hasLiveBuffer: !!state.buffer && !state.buffer.destroyed,
  }
  if (isActivePointMaskCurrentByReference(cacheState, layout)) {
    return state
  }
  const signature = getActivePointMaskSignature(layout)
  if (isActivePointMaskCurrentBySignature(cacheState, layout, signature)) {
    return state
  }

  let buffer = state.buffer
  let capacity = state.capacity
  let recreated = false
  if (shouldRecreateActivePointMaskBuffer(cacheState, layout)) {
    if (buffer && !buffer.destroyed) buffer.destroy()
    buffer = device.createBuffer({
      byteLength: layout.expectedBytes,
      usage: Buffer.STORAGE | Buffer.COPY_DST,
    })
    capacity = layout.requiredCapacity
    recreated = true
  }
  if (!state.dirty && !recreated && state.signature === signature) return state
  if (!buffer || buffer.destroyed) return state

  buffer.write(createActivePointMaskData(layout))
  return {
    buffer,
    capacity,
    signature,
    pointCount: layout.pointCount,
    indicesRef: layout.activePointIndices,
    dirty: false,
  }
}

function isActivePointMaskCacheCurrent (
  cache: ActivePointMaskCacheState,
  layout: ActivePointMaskLayout,
): boolean {
  return (
    (!layout.hasActiveFilter || cache.pointCount === layout.pointCount) &&
    cache.hasLiveBuffer &&
    (layout.hasActiveFilter
      ? cache.capacity >= layout.requiredCapacity
      : cache.capacity === layout.requiredCapacity)
  )
}

function hashActivePointIndices (activePointIndices: readonly number[]): number {
  let hash = 2166136261
  for (const index of activePointIndices) {
    hash ^= index >>> 0
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash
}
