import { Device } from '@luma.gl/core'

import { createTimerQueryResources, type WebGPULikeDevice } from './timer-query-pool-webgpu-capability'
import { QUERY_SET_SIZE } from './timer-query-pool-webgpu-constants'
import {
  consumePendingForRawPass,
  type PendingTimestampPass,
  type TimestampPassHookContext,
} from './timer-query-pool-webgpu-pass-hooks'
import type { FrameRecord } from './timer-query-pool-webgpu-readback'
import {
  createTimestampPassHooks,
  destroyTimestampBuffers,
  installTimestampPassHooks,
  uninstallTimestampPassHooks,
  type TimestampPassHooks,
} from './timer-query-pool-webgpu-hook-lifecycle'
import {
  closeFrameForResolve,
  startMapForFrame,
} from './timer-query-pool-webgpu-resolve'
import { advanceTimerQueryFrame } from './timer-query-pool-webgpu-frame'
import { snapshotTimingStats, type PassStats } from './timer-query-pool-webgpu-stats'

import type { GpuTimingSnapshot } from './timer-query-pool'

export class TimerQueryPoolWebGPU {
  private device: WebGPULikeDevice | null = null
  private gpuDevice: GPUDevice | null = null
  private querySet: GPUQuerySet | null = null
  private resolveBuffer: GPUBuffer | null = null
  private stagingPool: GPUBuffer[] = []
  private hasTimestamp = false

  private nextIndex = 0
  private currentFrame: FrameRecord | null = null
  private inFlight: FrameRecord[] = []
  private stats = new Map<string, PassStats>()
  private skippedReentries = 0
  private skippedOverflow = 0

  // begin(label) stashes the next-pass timestamp slot indices here; the
  // beginRenderPass interceptor consumes it on the next call.
  private pending: PendingTimestampPass | null = null

  private passHooks: TimestampPassHooks = createTimestampPassHooks()
  private passHookContext: TimestampPassHookContext = {
    getPending: () => this.pending,
    getQuerySet: () => this.querySet,
    getCurrentFrame: () => this.currentFrame,
    clearPending: () => { this.pending = null },
  }

  public constructor (device: Device) {
    const resources = createTimerQueryResources(device)
    if (!resources) return

    this.device = resources.device
    this.gpuDevice = resources.gpuDevice
    this.querySet = resources.querySet
    this.resolveBuffer = resources.resolveBuffer

    this.passHooks = installTimestampPassHooks(this.device, this.passHookContext)
    this.hasTimestamp = true
  }

  public isSupported (): boolean {
    return this.hasTimestamp
  }

  public tick (): void {
    if (!this.hasTimestamp) return

    const nextFrameState = advanceTimerQueryFrame(
      { currentFrame: this.currentFrame, inFlight: this.inFlight },
      {
        closeFrameForResolve: frame => this.closeFrameForResolve(frame),
        startMapForFrame: frame => this.startMapForFrame(frame),
      }
    )

    this.currentFrame = nextFrameState.currentFrame
    this.inFlight = nextFrameState.inFlight
    this.nextIndex = 0
    this.pending = null
  }

  public begin (label: string): void {
    if (!this.hasTimestamp || !this.currentFrame) return
    if (this.pending) {
      // Stale begin: drop the prior pending, keep the new one.
      this.skippedReentries += 1
      this.pending = null
    }
    if (this.nextIndex + 2 > QUERY_SET_SIZE) {
      this.skippedOverflow += 1
      return
    }
    const beginIdx = this.nextIndex
    const endIdx = this.nextIndex + 1
    this.nextIndex += 2
    this.pending = { label, beginIdx, endIdx }
  }

  public end (): void {
    if (!this.hasTimestamp) return
    // If begin() was called but no render pass started, drop the pending so
    // the next pass isn't misattributed.
    if (this.pending) this.pending = null
  }

  public wrap (label: string, fn: () => void): void {
    this.begin(label)
    try { fn() } finally { this.end() }
  }

  /**
   * Hand-rolled-pass escape hatch. The canvas MSAA path bypasses luma's
   * `device.beginRenderPass` (because luma doesn't expose `resolveTarget`),
   * so the `installBeginRenderPassHook` interceptor never sees the call.
   * The engine calls this method right before `commandEncoder.beginRenderPass`
   * to consume the same `pending` slot that the hook would, and writes
   * `timestampWrites` directly into the raw descriptor.
   */
  public consumePendingForRawPass (descriptor: GPURenderPassDescriptor): void {
    if (!this.hasTimestamp) return
    consumePendingForRawPass(descriptor, this.passHookContext)
  }

  public getSnapshot (): GpuTimingSnapshot {
    return snapshotTimingStats(this.stats)
  }

  public reset (): void {
    this.inFlight = []
    this.stats.clear()
  }

  public destroy (): void {
    uninstallTimestampPassHooks(this.device, this.passHooks)
    this.inFlight = []
    this.stats.clear()
    this.currentFrame = null
    this.pending = null
    destroyTimestampBuffers(this.querySet, this.resolveBuffer, this.stagingPool)
    this.stagingPool = []
    this.querySet = null
    this.resolveBuffer = null
    this.device = null
    this.gpuDevice = null
    this.hasTimestamp = false
  }

  // Stage 1 (called from tick): encode resolveQuerySet + copyBufferToBuffer
  // into the current command encoder. Does NOT call mapAsync — that has to
  // wait until after submit() so the buffer isn't in a "mapping pending"
  // state when submit references it.
  private closeFrameForResolve (frame: FrameRecord): void {
    closeFrameForResolve({
      frame,
      device: this.device,
      gpuDevice: this.gpuDevice,
      querySet: this.querySet,
      resolveBuffer: this.resolveBuffer,
      stagingPool: this.stagingPool,
    })
  }

  // Stage 2 (called from a later tick, after the prior tick's submit): now
  // safe to mapAsync the staging buffer, decode timestamps, and recycle.
  private startMapForFrame (frame: FrameRecord): void {
    startMapForFrame(frame, () => this.gpuDevice, this.stagingPool, this.stats)
  }
}
