import type { WebGPULikeDevice } from './timer-query-pool-webgpu-capability'
import type { FrameRecord, TimestampPair } from './timer-query-pool-webgpu-readback'

export type PendingTimestampPass = TimestampPair
export type BeginPassFn = (props?: Record<string, unknown>) => unknown

export interface TimestampPassHookContext {
  getPending: () => PendingTimestampPass | null;
  getQuerySet: () => GPUQuerySet | null;
  getCurrentFrame: () => FrameRecord | null;
  clearPending: () => void;
}

export function installTimestampRenderPassHook (
  device: WebGPULikeDevice,
  context: TimestampPassHookContext
): BeginPassFn {
  const original = device.beginRenderPass.bind(device)
  device.beginRenderPass = createTimestampPassBegin(original, context)
  return original
}

export function installTimestampComputePassHook (
  device: WebGPULikeDevice,
  context: TimestampPassHookContext
): BeginPassFn {
  const original = device.beginComputePass.bind(device)
  device.beginComputePass = createTimestampPassBegin(original, context)
  return original
}

export function consumePendingForRawPass (
  descriptor: GPURenderPassDescriptor,
  context: TimestampPassHookContext
): void {
  const pending = context.getPending()
  const querySet = context.getQuerySet()
  const frame = context.getCurrentFrame()
  if (!pending || !querySet || !frame) return

  descriptor.timestampWrites = {
    querySet,
    beginningOfPassWriteIndex: pending.beginIdx,
    endOfPassWriteIndex: pending.endIdx,
  }
  recordTimestampPair(frame, pending)
  context.clearPending()
}

function createTimestampPassBegin (
  original: BeginPassFn,
  context: TimestampPassHookContext
): BeginPassFn {
  return (props?: Record<string, unknown>): unknown => {
    const pending = context.getPending()
    const querySet = context.getQuerySet()
    const frame = context.getCurrentFrame()
    if (pending && querySet && frame) {
      const merged = {
        ...(props ?? {}),
        timestampQuerySet: { handle: querySet },
        beginTimestampIndex: pending.beginIdx,
        endTimestampIndex: pending.endIdx,
      }
      recordTimestampPair(frame, pending)
      context.clearPending()
      return original(merged)
    }
    return original(props)
  }
}

function recordTimestampPair (frame: FrameRecord, pending: PendingTimestampPass): void {
  frame.pairs.push({
    label: pending.label,
    beginIdx: pending.beginIdx,
    endIdx: pending.endIdx,
  })
}
