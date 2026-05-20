import { ALPHA_MIN } from '@/graph/modules/Store'

import {
  INTERPOLATED_FORCE_THROTTLE_ALPHA,
  INTERPOLATED_FORCE_THROTTLE_POINTS,
  SETTLE_TAIL_ALPHA_THRESHOLD,
} from './runtime-contracts'

export interface IdleFrameSkipInput {
  disableIdleFrameSkip: boolean;
  isSimulationRunning: boolean;
  currentEvent: unknown;
  isZoomRunning: boolean;
  isDragActive: boolean;
  isRenderDirty: boolean;
  dprChanged: boolean;
}

export interface RenderDirtyState {
  isRenderDirty: boolean;
  renderDirtyFrameCount: number;
}

export interface CaptureRenderPositionsInput {
  isWebGPU: boolean;
  isSimulationRunning: boolean;
  alpha: number;
  pointCount: number;
  hasPositionStorageBuffer: boolean;
  hasPreviousRenderPositionStorageBuffer: boolean;
}

export function resolveAlphaStopThreshold (rawThreshold: number): number {
  return Number.isFinite(rawThreshold)
    ? Math.min(1, Math.max(ALPHA_MIN, rawThreshold))
    : ALPHA_MIN
}

export function getForceThrottleAlpha (pointCount: number): number {
  return pointCount >= INTERPOLATED_FORCE_THROTTLE_POINTS
    ? INTERPOLATED_FORCE_THROTTLE_ALPHA
    : SETTLE_TAIL_ALPHA_THRESHOLD
}

export function shouldSkipIdleFrame ({
  disableIdleFrameSkip,
  isSimulationRunning,
  currentEvent,
  isZoomRunning,
  isDragActive,
  isRenderDirty,
  dprChanged,
}: IdleFrameSkipInput): boolean {
  return !disableIdleFrameSkip &&
    !isSimulationRunning &&
    !currentEvent &&
    !isZoomRunning &&
    !isDragActive &&
    !isRenderDirty &&
    !dprChanged
}

export function consumeRenderDirtyFrame (state: RenderDirtyState): RenderDirtyState {
  const renderDirtyFrameCount = state.renderDirtyFrameCount > 0
    ? state.renderDirtyFrameCount - 1
    : state.renderDirtyFrameCount
  return {
    renderDirtyFrameCount,
    isRenderDirty: renderDirtyFrameCount > 0,
  }
}

export function shouldCaptureRenderPositions ({
  isWebGPU,
  isSimulationRunning,
  alpha,
  pointCount,
  hasPositionStorageBuffer,
  hasPreviousRenderPositionStorageBuffer,
}: CaptureRenderPositionsInput): boolean {
  return isWebGPU &&
    isSimulationRunning &&
    alpha < getForceThrottleAlpha(pointCount) &&
    hasPositionStorageBuffer &&
    hasPreviousRenderPositionStorageBuffer
}
