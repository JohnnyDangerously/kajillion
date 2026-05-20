import type { FramePacingStats } from './runtime-contracts'

const COMMON_REFRESH_HZ = [60, 72, 75, 90, 100, 120, 144, 165, 180, 240] as const

export interface FramePacingCounters {
  estimatedRefreshHz: number;
  rafCallbackCount: number;
  renderedFrameCount: number;
  skippedFrameCount: number;
}

export interface FramePacingEstimateState {
  lastRafFrameMs: number;
  estimatedRefreshHz: number;
  nextRenderEligibleMs: number;
}

export interface RafRenderDecision {
  shouldRender: boolean;
  nextRenderEligibleMs: number;
}

export const roundRefreshHz = (estimatedRefreshHz: number): number => {
  let best: number = COMMON_REFRESH_HZ[0]
  let bestDiff = Math.abs(estimatedRefreshHz - best)
  for (const hz of COMMON_REFRESH_HZ) {
    const diff = Math.abs(estimatedRefreshHz - hz)
    if (diff < bestDiff) {
      best = hz
      bestDiff = diff
    }
  }
  return best
}

export const getTargetRenderFps = (
  frameRateLimit: number,
  frameRateHeadroomFps: number,
  estimatedRefreshHz: number,
): number => {
  const sanitizedFrameRateLimit = Number.isFinite(frameRateLimit) ? frameRateLimit : 0
  if (sanitizedFrameRateLimit > 0) return sanitizedFrameRateLimit

  const headroom = Number.isFinite(frameRateHeadroomFps) ? frameRateHeadroomFps : 0
  if (headroom <= 0) return 0

  const refreshHz = roundRefreshHz(estimatedRefreshHz)
  if (refreshHz <= 60) return 0
  return Math.max(30, refreshHz - headroom)
}

export const createFramePacingStats = (
  counters: FramePacingCounters,
  targetFps: number,
): FramePacingStats => {
  const total = counters.renderedFrameCount + counters.skippedFrameCount
  return {
    estimatedRefreshHz: counters.estimatedRefreshHz,
    roundedRefreshHz: roundRefreshHz(counters.estimatedRefreshHz),
    targetFps,
    rafCallbacks: counters.rafCallbackCount,
    renderedFrames: counters.renderedFrameCount,
    skippedFrames: counters.skippedFrameCount,
    skipRatio: total > 0 ? counters.skippedFrameCount / total : 0,
  }
}

export const updateRefreshEstimate = (
  state: FramePacingEstimateState,
  now: number,
  isDocumentVisible: boolean,
): FramePacingEstimateState => {
  if (!isDocumentVisible) {
    return { ...state, lastRafFrameMs: now }
  }

  let estimatedRefreshHz = state.estimatedRefreshHz
  let nextRenderEligibleMs = state.nextRenderEligibleMs
  if (state.lastRafFrameMs > 0) {
    const dt = now - state.lastRafFrameMs
    if (dt > 3 && dt < 40) {
      const hz = 1000 / dt
      if (hz >= 30 && hz <= 360) {
        estimatedRefreshHz = estimatedRefreshHz * 0.92 + hz * 0.08
      }
    } else if (dt >= 250) {
      nextRenderEligibleMs = 0
    }
  }

  return {
    lastRafFrameMs: now,
    estimatedRefreshHz,
    nextRenderEligibleMs,
  }
}

export const shouldRenderOnRaf = (
  now: number,
  targetFps: number,
  nextRenderEligibleMs: number,
): RafRenderDecision => {
  if (targetFps <= 0) return { shouldRender: true, nextRenderEligibleMs }

  const intervalMs = 1000 / targetFps
  const epsilonMs = 0.25
  if (nextRenderEligibleMs === 0) {
    return { shouldRender: true, nextRenderEligibleMs: now + intervalMs }
  }
  if (now + epsilonMs < nextRenderEligibleMs) {
    return { shouldRender: false, nextRenderEligibleMs }
  }

  let updatedNextEligibleMs = nextRenderEligibleMs
  do {
    updatedNextEligibleMs += intervalMs
  } while (now >= updatedNextEligibleMs)
  return { shouldRender: true, nextRenderEligibleMs: updatedNextEligibleMs }
}
