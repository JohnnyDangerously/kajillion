import type { WebGPULikeDevice } from './timer-query-pool-webgpu-capability'
import {
  installTimestampComputePassHook,
  installTimestampRenderPassHook,
  type BeginPassFn,
  type TimestampPassHookContext,
} from './timer-query-pool-webgpu-pass-hooks'

export interface TimestampPassHooks {
  beginRenderPass: BeginPassFn | null;
  beginComputePass: BeginPassFn | null;
}

export function createTimestampPassHooks (): TimestampPassHooks {
  return { beginRenderPass: null, beginComputePass: null }
}

export function installTimestampPassHooks (
  device: WebGPULikeDevice,
  context: TimestampPassHookContext
): TimestampPassHooks {
  return {
    beginRenderPass: installTimestampRenderPassHook(device, context),
    beginComputePass: installTimestampComputePassHook(device, context),
  }
}

export function uninstallTimestampPassHooks (
  device: WebGPULikeDevice | null,
  hooks: TimestampPassHooks
): void {
  if (device && hooks.beginRenderPass) device.beginRenderPass = hooks.beginRenderPass
  if (device && hooks.beginComputePass) device.beginComputePass = hooks.beginComputePass
  hooks.beginRenderPass = null
  hooks.beginComputePass = null
}

export function destroyTimestampBuffers (
  querySet: GPUQuerySet | null,
  resolveBuffer: GPUBuffer | null,
  stagingPool: GPUBuffer[]
): void {
  try { querySet?.destroy() } catch { /* ignore */ }
  try { resolveBuffer?.destroy() } catch { /* ignore */ }
  for (const b of stagingPool) {
    try { b.destroy() } catch { /* ignore */ }
  }
}
