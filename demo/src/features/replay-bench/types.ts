import type { Graph, GpuTimingSnapshot } from '@kajillion/graph'

export interface BaselineRun {
  wallFps: number;
  wallFpsIdle: number;
  gpuTimings: GpuTimingSnapshot;
}

export type MemorySnapshot = {
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit?: number;
}

export interface ReplaySample {
  t: number;
  step: string;
  wallFps: number;
  renderFps: number | null;
  gpuFrameMs: number;
  dpr: number;
  alpha: number;
  simulationRunning: boolean;
  pacing: ReturnType<Graph['getFramePacingStats']>;
  memory?: MemorySnapshot;
}

export interface ReplayStepSummary {
  name: string;
  durationMs: number;
  samples: number;
  wallFpsMedian: number;
  gpuFrameMsMedian: number;
  dprMedian: number;
  skipRatioMax: number;
}
