import { Device } from '@luma.gl/core'

import { BYTES_PER_TIMESTAMP, QUERY_SET_SIZE } from './timer-query-pool-webgpu-constants'

// Structural view of the bits of @luma.gl/webgpu we need at runtime. We avoid
// importing the package types directly so this file stays loosely coupled.
export interface WebGPULikeDevice {
  handle: GPUDevice;
  commandEncoder: { handle: GPUCommandEncoder };
  features: { has: (name: string) => boolean };
  beginRenderPass: (props?: Record<string, unknown>) => unknown;
  beginComputePass: (props?: Record<string, unknown>) => unknown;
}

export interface TimerQueryResources {
  device: WebGPULikeDevice;
  gpuDevice: GPUDevice;
  querySet: GPUQuerySet;
  resolveBuffer: GPUBuffer;
}

export function createTimerQueryResources (device: Device): TimerQueryResources | null {
  if (device.info.type !== 'webgpu') {
    // Not a WebGPU device; pool is a no-op.
    return null
  }
  const wgpu = device as unknown as WebGPULikeDevice
  if (!wgpu.handle || !wgpu.features) return null
  if (!wgpu.features.has('timestamp-query')) {
    console.warn(
      '[kajillion] WebGPU timestamp-query feature unavailable; GPU per-pass timings disabled. ' +
      'Enable chrome://flags/#enable-webgpu-developer-features and ensure the adapter exposes timestamp-query.'
    )
    return null
  }

  let querySet: GPUQuerySet | null = null
  let resolveBuffer: GPUBuffer | null = null
  try {
    querySet = wgpu.handle.createQuerySet({
      type: 'timestamp',
      count: QUERY_SET_SIZE,
      label: 'kajillion-timer-query-pool',
    })
    resolveBuffer = wgpu.handle.createBuffer({
      size: QUERY_SET_SIZE * BYTES_PER_TIMESTAMP,
      // QUERY_RESOLVE is the only legal destination for resolveQuerySet;
      // a separate MAP_READ staging buffer is required for readback (a single
      // buffer cannot carry both usages per WebGPU spec).
      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
      label: 'kajillion-timer-resolve',
    })
  } catch (e) {
    console.warn('[kajillion] timestamp-query setup failed; GPU timings disabled.', e)
    try { querySet?.destroy() } catch { /* ignore */ }
    try { resolveBuffer?.destroy() } catch { /* ignore */ }
    return null
  }

  return {
    device: wgpu,
    gpuDevice: wgpu.handle,
    querySet,
    resolveBuffer,
  }
}
