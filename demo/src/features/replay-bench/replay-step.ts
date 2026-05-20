import type { Graph } from '@kajillion/graph'
import { collectReplaySample, delay, summarizeReplayStep } from './metrics'
import type { ReplaySample, ReplayStepSummary } from './types'

export interface ReplayStepRuntime {
  graphHost: HTMLDivElement;
  getWallFpsLatest: () => number;
  getRenderFps: () => number | undefined;
}

export async function runMeasuredReplayStep (
  runtime: ReplayStepRuntime,
  graph: Graph,
  name: string,
  durationMs: number,
  samples: ReplaySample[],
  replayStart: number,
  action: (elapsed: number, progress: number) => void | Promise<void>,
  status: (s: string) => void
): Promise<ReplayStepSummary> {
  status(`${name}...`)
  const stepStart = performance.now()
  await action(0, 0)
  let lastSample = 0
  while (performance.now() - stepStart < durationMs) {
    const elapsed = performance.now() - stepStart
    const progress = Math.max(0, Math.min(1, elapsed / durationMs))
    await action(elapsed, progress)
    if (elapsed - lastSample >= 200) {
      samples.push(collectReplaySample(graph, name, replayStart, {
        graphHost: runtime.graphHost,
        wallFpsLatest: runtime.getWallFpsLatest(),
        renderFps: runtime.getRenderFps(),
      }))
      lastSample = elapsed
    }
    await delay(16)
  }
  samples.push(collectReplaySample(graph, name, replayStart, {
    graphHost: runtime.graphHost,
    wallFpsLatest: runtime.getWallFpsLatest(),
    renderFps: runtime.getRenderFps(),
  }))
  return summarizeReplayStep(name, durationMs, samples)
}
