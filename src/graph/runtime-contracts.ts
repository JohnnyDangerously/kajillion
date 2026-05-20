// Below this alpha, force passes throttle to every-other-frame in
// runSimulationStep. 0.3 keeps the initial "spring + settle" motion at
// full fidelity (alpha decays from 1 -> 0.3 covers ~70% of the visible
// motion) and only throttles during the long tail where per-frame
// displacement is sub-pixel anyway.
export const SETTLE_TAIL_ALPHA_THRESHOLD = 0.3
export const INTERPOLATED_FORCE_THROTTLE_POINTS = 100000
export const INTERPOLATED_FORCE_THROTTLE_ALPHA = 0.82

export const responsiveCameraEase = (t: number): number => {
  const x = Math.max(0, Math.min(1, t / 0.82))
  return x < 0.5 ? 2 * x * x : 1 - ((-2 * x + 2) ** 2) / 2
}

export interface FramePacingStats {
  estimatedRefreshHz: number;
  roundedRefreshHz: number;
  targetFps: number;
  rafCallbacks: number;
  renderedFrames: number;
  skippedFrames: number;
  skipRatio: number;
}

export interface DebugFrameTraceEvent {
  t: number;
  name: string;
  raf: number;
  rendered: number;
  skipped: number;
  alpha: number;
  sim: boolean;
  zoom: boolean;
  drag: boolean;
  dirty: boolean;
  dirtyFrames: number;
  eventType?: string;
  camera: { x: number; y: number; k: number };
  screen: [number, number];
  canvas?: { clientWidth: number; clientHeight: number; width: number; height: number };
  data?: Record<string, unknown>;
}

export interface WebGpuPointPickerGrid {
  positions: Float32Array;
  cellSize: number;
  columns: number;
  rows: number;
  buckets: Int32Array[];
}

export interface WebGpuLinkPickerGrid {
  positions: Float32Array;
  links: Float32Array;
  cellSize: number;
  columns: number;
  rows: number;
  cellOffsets: Int32Array;
  cellEntries: Int32Array;
  visitMarks: Uint32Array;
  visitToken: number;
}
