import { createFrameRecord, type FrameRecord } from './timer-query-pool-webgpu-readback'
import { drainReadyFrames } from './timer-query-pool-webgpu-resolve'

export interface TimerQueryFrameState {
  currentFrame: FrameRecord | null;
  inFlight: FrameRecord[];
}

interface AdvanceTimerQueryFrameCallbacks {
  closeFrameForResolve: (frame: FrameRecord) => void;
  startMapForFrame: (frame: FrameRecord) => void;
}

export function advanceTimerQueryFrame (
  state: TimerQueryFrameState,
  callbacks: AdvanceTimerQueryFrameCallbacks
): TimerQueryFrameState {
  for (const frame of state.inFlight) {
    if (frame.copyScheduled && !frame.mapInFlight && frame.stagingBuffer) {
      callbacks.startMapForFrame(frame)
    }
  }

  if (state.currentFrame && state.currentFrame.pairs.length > 0) {
    callbacks.closeFrameForResolve(state.currentFrame)
    state.inFlight.push(state.currentFrame)
  }

  return {
    currentFrame: createFrameRecord(),
    inFlight: drainReadyFrames(state.inFlight),
  }
}
