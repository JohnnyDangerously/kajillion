import type { WebGPULikeDevice } from './timer-query-pool-webgpu-capability'
import { computeQueryRange, decodeTimestamps, type FrameRecord } from './timer-query-pool-webgpu-readback'
import { recordTimingSample, type PassStats } from './timer-query-pool-webgpu-stats'

interface CloseFrameForResolveOptions {
  frame: FrameRecord;
  device: WebGPULikeDevice | null;
  gpuDevice: GPUDevice | null;
  querySet: GPUQuerySet | null;
  resolveBuffer: GPUBuffer | null;
  stagingPool: GPUBuffer[];
}

export function closeFrameForResolve (options: CloseFrameForResolveOptions): void {
  const { frame, device, gpuDevice, querySet, resolveBuffer, stagingPool } = options
  if (!gpuDevice || !querySet || !resolveBuffer || !device) return

  const range = computeQueryRange(frame)
  if (!range) return

  const encoder = device.commandEncoder.handle
  encoder.resolveQuerySet(querySet, range.firstQuery, range.queryCount, resolveBuffer, 0)
  const staging = acquireStagingBuffer(stagingPool, gpuDevice, range.byteLength)
  encoder.copyBufferToBuffer(resolveBuffer, 0, staging, 0, range.byteLength)

  frame.stagingBuffer = staging
  frame.byteLength = range.byteLength
  frame.copyScheduled = true
}

export function startMapForFrame (
  frame: FrameRecord,
  getGpuDevice: () => GPUDevice | null,
  stagingPool: GPUBuffer[],
  stats: Map<string, PassStats>
): void {
  const staging = frame.stagingBuffer
  if (!staging) return

  const byteLength = frame.byteLength
  frame.mapInFlight = true

  const queryRange = computeQueryRange(frame)
  if (!queryRange) {
    frame.mapInFlight = false
    return
  }

  staging.mapAsync(GPUMapMode.READ, 0, byteLength).then(() => {
    if (!getGpuDevice()) return

    const bufferRange = staging.getMappedRange(0, byteLength)
    const timestamps = decodeTimestamps(bufferRange, queryRange.queryCount)
    staging.unmap()

    for (const p of frame.pairs) {
      const beginT = timestamps[p.beginIdx - queryRange.firstQuery] as bigint
      const endT = timestamps[p.endIdx - queryRange.firstQuery] as bigint
      if (endT < beginT) continue
      recordTimingSample(stats, p.label, Number(endT - beginT))
    }

    stagingPool.push(staging)
    frame.stagingBuffer = null
    frame.mapInFlight = false
  }).catch(() => {
    frame.mapInFlight = false
  })
}

export function drainReadyFrames (inFlight: FrameRecord[]): FrameRecord[] {
  const remaining: FrameRecord[] = []
  for (const frame of inFlight) {
    if (frame.mapInFlight || frame.stagingBuffer) remaining.push(frame)
  }
  return remaining
}

function acquireStagingBuffer (
  stagingPool: GPUBuffer[],
  gpuDevice: GPUDevice,
  byteLength: number
): GPUBuffer {
  const idx = stagingPool.findIndex(b => b.size >= byteLength)
  if (idx >= 0) {
    const buffer = stagingPool[idx] as GPUBuffer
    stagingPool.splice(idx, 1)
    return buffer
  }
  return gpuDevice.createBuffer({
    size: byteLength,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    label: 'kajillion-timer-staging',
  })
}
