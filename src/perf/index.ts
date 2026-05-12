import { Device } from '@luma.gl/core'

import { TimerQueryPool as TimerQueryPoolWebGL2 } from './timer-query-pool'
import { TimerQueryPoolWebGPU } from './timer-query-pool-webgpu'

import type { GpuTimingSnapshot } from './timer-query-pool'

export type { GpuPassTiming, GpuTimingSnapshot } from './timer-query-pool'

// Structural type both backends satisfy. The Graph class holds this opaque
// handle so call sites don't depend on the underlying backend identity.
export interface ITimerQueryPool {
  isSupported(): boolean;
  tick(): void;
  begin(label: string): void;
  end(): void;
  wrap(label: string, fn: () => void): void;
  getSnapshot(): GpuTimingSnapshot;
  reset(): void;
  destroy(): void;
}

/**
 * Constructs the backend-appropriate timer query pool. The returned pool may
 * report `isSupported() === false` if the underlying extension/feature is
 * missing; callers null-check via `isSupported()` rather than try/catch.
 */
export function createTimerQueryPool (device: Device): ITimerQueryPool {
  if (device.info.type === 'webgpu') {
    return new TimerQueryPoolWebGPU(device)
  }
  return new TimerQueryPoolWebGL2(device)
}

// Re-export under the legacy name so existing call sites importing
// `TimerQueryPool` keep compiling. New code should use createTimerQueryPool().
export { TimerQueryPoolWebGL2 as TimerQueryPool }
