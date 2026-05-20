import { type GpuTimingSnapshot, type ITimerQueryPool } from '@/graph/perf'
import { type ResolvedRenderPolicy } from '@/graph/render/resolveAdaptiveRenderPolicy'

import { createFramePacingStats } from './frame-pacing'
import { cloneDebugFrameTrace } from './debug-frame-trace'
import { type DebugFrameTraceEvent, type FramePacingStats } from './runtime-contracts'

export interface RuntimeFramePacingSnapshotInput {
  estimatedRefreshHz: number;
  rafCallbackCount: number;
  renderedFrameCount: number;
  skippedFrameCount: number;
  targetFps: number;
}

export function getRuntimeGpuTimings (
  isDestroyed: boolean,
  timerQueryPool: ITimerQueryPool | undefined
): GpuTimingSnapshot | null {
  if (isDestroyed || !timerQueryPool) return null
  if (!timerQueryPool.isSupported()) return null
  return timerQueryPool.getSnapshot()
}

export function getRuntimeFramePacingStats ({
  estimatedRefreshHz,
  rafCallbackCount,
  renderedFrameCount,
  skippedFrameCount,
  targetFps,
}: RuntimeFramePacingSnapshotInput): FramePacingStats {
  return createFramePacingStats({
    estimatedRefreshHz,
    rafCallbackCount,
    renderedFrameCount,
    skippedFrameCount,
  }, targetFps)
}

export function cloneRuntimeDebugFrameTrace (trace: readonly DebugFrameTraceEvent[]): DebugFrameTraceEvent[] {
  return cloneDebugFrameTrace(trace)
}

export function cloneResolvedRenderPolicy (
  resolvedRenderPolicy: ResolvedRenderPolicy | undefined
): ResolvedRenderPolicy | undefined {
  if (!resolvedRenderPolicy) return undefined
  return {
    ...resolvedRenderPolicy,
    reasons: [...resolvedRenderPolicy.reasons],
  }
}

export function resetRuntimeGpuTimings (
  isDestroyed: boolean,
  timerQueryPool: ITimerQueryPool | undefined
): void {
  if (isDestroyed || !timerQueryPool) return
  timerQueryPool.reset()
}
