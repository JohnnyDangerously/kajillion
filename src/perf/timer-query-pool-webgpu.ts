import { Device } from '@luma.gl/core'

import type { GpuTimingSnapshot } from './timer-query-pool'

const ROLLING_WINDOW = 60

// Each begin/end pair consumes 2 timestamp slots. The current per-frame call
// sites top out at ~9 passes; 128 leaves comfortable headroom.
const MAX_PASSES_PER_FRAME = 128
const QUERY_SET_SIZE = MAX_PASSES_PER_FRAME * 2
const BYTES_PER_TIMESTAMP = 8

interface FrameRecord {
  pairs: Array<{ label: string; beginIdx: number; endIdx: number }>;
  stagingBuffer: GPUBuffer | null;
  byteLength: number;
  copyScheduled: boolean;
  mapInFlight: boolean;
}

interface PassStats {
  label: string;
  count: number;
  samples: number[];
  sampleIdx: number;
  filled: number;
}

// Structural view of the bits of @luma.gl/webgpu we need at runtime. We avoid
// importing the package types directly so this file stays loosely coupled.
interface WebGPULikeDevice {
  handle: GPUDevice;
  commandEncoder: { handle: GPUCommandEncoder };
  features: { has: (name: string) => boolean };
  beginRenderPass: (props?: Record<string, unknown>) => unknown;
  beginComputePass: (props?: Record<string, unknown>) => unknown;
}

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
  private pending: { label: string; beginIdx: number; endIdx: number } | null = null

  private originalBeginRenderPass: ((props?: Record<string, unknown>) => unknown) | null = null
  private originalBeginComputePass: ((props?: Record<string, unknown>) => unknown) | null = null

  public constructor (device: Device) {
    if (device.info.type !== 'webgpu') {
      // Not a WebGPU device; pool is a no-op.
      return
    }
    const wgpu = device as unknown as WebGPULikeDevice
    if (!wgpu.handle || !wgpu.features) return
    if (!wgpu.features.has('timestamp-query')) {
      console.warn(
        '[kajillion] WebGPU timestamp-query feature unavailable; GPU per-pass timings disabled. ' +
        'Enable chrome://flags/#enable-webgpu-developer-features and ensure the adapter exposes timestamp-query.'
      )
      return
    }

    this.device = wgpu
    this.gpuDevice = wgpu.handle

    try {
      this.querySet = this.gpuDevice.createQuerySet({
        type: 'timestamp',
        count: QUERY_SET_SIZE,
        label: 'kajillion-timer-query-pool',
      })
      this.resolveBuffer = this.gpuDevice.createBuffer({
        size: QUERY_SET_SIZE * BYTES_PER_TIMESTAMP,
        // QUERY_RESOLVE is the only legal destination for resolveQuerySet;
        // a separate MAP_READ staging buffer is required for readback (a single
        // buffer cannot carry both usages per WebGPU spec).
        usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
        label: 'kajillion-timer-resolve',
      })
    } catch (e) {
      console.warn('[kajillion] timestamp-query setup failed; GPU timings disabled.', e)
      try { this.querySet?.destroy() } catch { /* ignore */ }
      try { this.resolveBuffer?.destroy() } catch { /* ignore */ }
      this.querySet = null
      this.resolveBuffer = null
      this.device = null
      this.gpuDevice = null
      return
    }

    this.installBeginRenderPassHook()
    this.installBeginComputePassHook()
    this.hasTimestamp = true
  }

  public isSupported (): boolean {
    return this.hasTimestamp
  }

  public tick (): void {
    if (!this.hasTimestamp) return

    // Step 1: any frame whose copy was queued in a prior tick has now been
    // submitted (luma.gl submits the encoder at end-of-frame). Kick mapAsync
    // now that the buffer's "mapping pending" state won't conflict with a
    // pending submit.
    for (const f of this.inFlight) {
      if (f.copyScheduled && !f.mapInFlight && f.stagingBuffer) {
        this.startMapForFrame(f)
      }
    }

    // Step 2: close the just-finished frame: schedule a resolve + copy into
    // the *current* encoder. mapAsync is deferred to the next tick (step 1
    // above on the next call). The resolve + copy ride on this frame's
    // submit so no extra submission is needed.
    if (this.currentFrame && this.currentFrame.pairs.length > 0) {
      this.closeFrameForResolve(this.currentFrame)
      this.inFlight.push(this.currentFrame)
    }

    this.currentFrame = { pairs: [], stagingBuffer: null, byteLength: 0, copyScheduled: false, mapInFlight: false }
    this.nextIndex = 0
    this.pending = null

    this.drainReady()
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

  public getSnapshot (): GpuTimingSnapshot {
    const out: GpuTimingSnapshot = {}
    for (const [label, s] of this.stats) {
      if (s.filled === 0) continue
      let sum = 0
      for (let i = 0; i < s.filled; i += 1) sum += s.samples[i] as number
      const avgNs = sum / s.filled
      const lastIdx = (s.sampleIdx - 1 + ROLLING_WINDOW) % ROLLING_WINDOW
      const lastNs = (s.samples[lastIdx] ?? 0) as number
      out[label] = {
        avgMs: avgNs / 1e6,
        lastMs: lastNs / 1e6,
        sampleCount: s.count,
      }
    }
    return out
  }

  public reset (): void {
    this.inFlight = []
    this.stats.clear()
  }

  public destroy (): void {
    this.uninstallBeginRenderPassHook()
    this.uninstallBeginComputePassHook()
    this.inFlight = []
    this.stats.clear()
    this.currentFrame = null
    this.pending = null
    try { this.querySet?.destroy() } catch { /* ignore */ }
    try { this.resolveBuffer?.destroy() } catch { /* ignore */ }
    for (const b of this.stagingPool) {
      try { b.destroy() } catch { /* ignore */ }
    }
    this.stagingPool = []
    this.querySet = null
    this.resolveBuffer = null
    this.device = null
    this.gpuDevice = null
    this.hasTimestamp = false
  }

  private installBeginRenderPassHook (): void {
    if (!this.device) return
    const original = this.device.beginRenderPass.bind(this.device)
    this.originalBeginRenderPass = original
    this.device.beginRenderPass = (props?: Record<string, unknown>): unknown => {
      const pending = this.pending
      if (pending && this.querySet && this.currentFrame) {
        // luma.gl's WebGPURenderPass accepts these props and constructs the
        // GPURenderPassDescriptor.timestampWrites field from them.
        const querySetShim = { handle: this.querySet }
        const merged = {
          ...(props ?? {}),
          timestampQuerySet: querySetShim,
          beginTimestampIndex: pending.beginIdx,
          endTimestampIndex: pending.endIdx,
        }
        this.currentFrame.pairs.push({
          label: pending.label,
          beginIdx: pending.beginIdx,
          endIdx: pending.endIdx,
        })
        this.pending = null
        return original(merged)
      }
      return original(props)
    }
  }

  private uninstallBeginRenderPassHook (): void {
    if (this.device && this.originalBeginRenderPass) {
      this.device.beginRenderPass = this.originalBeginRenderPass
    }
    this.originalBeginRenderPass = null
  }

  private installBeginComputePassHook (): void {
    if (!this.device) return
    const original = this.device.beginComputePass.bind(this.device)
    this.originalBeginComputePass = original
    // Mirrors installBeginRenderPassHook. Compute passes accept the same
    // luma.gl timestamp props (timestampQuerySet / beginTimestampIndex /
    // endTimestampIndex) — WebGPUComputePass funnels them into the
    // GPUComputePassDescriptor.timestampWrites field. Same pending-slot
    // contract as the render-pass hook: begin(label) stages indices, the
    // next pass-start call (render OR compute) consumes them.
    this.device.beginComputePass = (props?: Record<string, unknown>): unknown => {
      const pending = this.pending
      if (pending && this.querySet && this.currentFrame) {
        const querySetShim = { handle: this.querySet }
        const merged = {
          ...(props ?? {}),
          timestampQuerySet: querySetShim,
          beginTimestampIndex: pending.beginIdx,
          endTimestampIndex: pending.endIdx,
        }
        this.currentFrame.pairs.push({
          label: pending.label,
          beginIdx: pending.beginIdx,
          endIdx: pending.endIdx,
        })
        this.pending = null
        return original(merged)
      }
      return original(props)
    }
  }

  private uninstallBeginComputePassHook (): void {
    if (this.device && this.originalBeginComputePass) {
      this.device.beginComputePass = this.originalBeginComputePass
    }
    this.originalBeginComputePass = null
  }

  private acquireStagingBuffer (byteLength: number): GPUBuffer {
    const idx = this.stagingPool.findIndex(b => b.size >= byteLength)
    if (idx >= 0) {
      const b = this.stagingPool[idx] as GPUBuffer
      this.stagingPool.splice(idx, 1)
      return b
    }
    return (this.gpuDevice as GPUDevice).createBuffer({
      size: byteLength,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      label: 'kajillion-timer-staging',
    })
  }

  // Stage 1 (called from tick): encode resolveQuerySet + copyBufferToBuffer
  // into the current command encoder. Does NOT call mapAsync — that has to
  // wait until after submit() so the buffer isn't in a "mapping pending"
  // state when submit references it.
  private closeFrameForResolve (frame: FrameRecord): void {
    if (!this.gpuDevice || !this.querySet || !this.resolveBuffer || !this.device) return
    let minIdx = Number.POSITIVE_INFINITY
    let maxIdx = -1
    for (const p of frame.pairs) {
      if (p.beginIdx < minIdx) minIdx = p.beginIdx
      if (p.endIdx > maxIdx) maxIdx = p.endIdx
    }
    if (maxIdx < 0) return
    const firstQuery = minIdx
    const queryCount = (maxIdx - minIdx) + 1
    const byteLength = queryCount * BYTES_PER_TIMESTAMP

    const encoder = this.device.commandEncoder.handle
    encoder.resolveQuerySet(this.querySet, firstQuery, queryCount, this.resolveBuffer, 0)
    const staging = this.acquireStagingBuffer(byteLength)
    encoder.copyBufferToBuffer(this.resolveBuffer, 0, staging, 0, byteLength)

    frame.stagingBuffer = staging
    frame.byteLength = byteLength
    frame.copyScheduled = true
  }

  // Stage 2 (called from a later tick, after the prior tick's submit): now
  // safe to mapAsync the staging buffer, decode timestamps, and recycle.
  private startMapForFrame (frame: FrameRecord): void {
    const staging = frame.stagingBuffer
    if (!staging) return
    const byteLength = frame.byteLength
    frame.mapInFlight = true

    let minIdx = Number.POSITIVE_INFINITY
    for (const p of frame.pairs) if (p.beginIdx < minIdx) minIdx = p.beginIdx
    const firstQuery = minIdx
    const queryCount = byteLength / BYTES_PER_TIMESTAMP

    staging.mapAsync(GPUMapMode.READ, 0, byteLength).then(() => {
      if (!this.gpuDevice) {
        return
      }
      const range = staging.getMappedRange(0, byteLength)
      const view = new DataView(range)
      const timestamps = new Array<bigint>(queryCount)
      for (let i = 0; i < queryCount; i += 1) {
        const lo = view.getUint32(i * 8, true)
        const hi = view.getUint32(i * 8 + 4, true)
        timestamps[i] = (BigInt(hi) * BigInt(0x100000000)) + BigInt(lo)
      }
      staging.unmap()

      for (const p of frame.pairs) {
        const beginT = timestamps[p.beginIdx - firstQuery] as bigint
        const endT = timestamps[p.endIdx - firstQuery] as bigint
        if (endT < beginT) continue
        const deltaNs = Number(endT - beginT)
        this.recordSample(p.label, deltaNs)
      }

      this.stagingPool.push(staging)
      frame.stagingBuffer = null
      frame.mapInFlight = false
    }).catch(() => {
      frame.mapInFlight = false
    })
  }

  private drainReady (): void {
    if (this.inFlight.length === 0) return
    const remaining: FrameRecord[] = []
    for (const f of this.inFlight) {
      if (f.mapInFlight || f.stagingBuffer) remaining.push(f)
    }
    this.inFlight = remaining
  }

  private recordSample (label: string, ns: number): void {
    let s = this.stats.get(label)
    if (!s) {
      s = {
        label,
        count: 0,
        samples: new Array<number>(ROLLING_WINDOW).fill(0),
        sampleIdx: 0,
        filled: 0,
      }
      this.stats.set(label, s)
    }
    s.samples[s.sampleIdx] = ns
    s.sampleIdx = (s.sampleIdx + 1) % ROLLING_WINDOW
    s.count += 1
    if (s.filled < ROLLING_WINDOW) s.filled += 1
  }
}
