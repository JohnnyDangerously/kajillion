import type { Graph, GpuTimingSnapshot } from '@kajillion/graph'
import { effectiveDpr, estimateGpuFrameMs, statMs } from '../control-plane/perf-overlay'
import type { BaselineRun, MemorySnapshot, ReplaySample, ReplayStepSummary } from './types'

export function delay (ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function downloadBlob (blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export async function measureWallFps (windowMs: number): Promise<number> {
  let frames = 0
  let active = true
  const tick = (): void => {
    if (!active) return
    frames += 1
    requestAnimationFrame(tick)
  }
  const start = performance.now()
  requestAnimationFrame(tick)
  await delay(windowMs)
  active = false
  const elapsed = performance.now() - start
  return elapsed > 0 ? (frames * 1000) / elapsed : 0
}

export function median (xs: number[]): number {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

export function percentile (xs: number[], p: number): number {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx] ?? 0
}

export function aggregateGpu (runs: BaselineRun[]): Record<string, { median: number; min: number; max: number; runs: number }> {
  const keys = new Set<string>()
  for (const r of runs) Object.keys(r.gpuTimings).forEach(k => keys.add(k))
  const out: Record<string, { median: number; min: number; max: number; runs: number }> = {}
  for (const k of keys) {
    const medians: number[] = []
    for (const r of runs) {
      const ms = statMs(r.gpuTimings, k)
      if (ms > 0) medians.push(ms)
    }
    if (medians.length === 0) continue
    out[k] = {
      median: median(medians),
      min: Math.min(...medians),
      max: Math.max(...medians),
      runs: medians.length,
    }
  }
  return out
}

export function memorySnapshot (): MemorySnapshot | undefined {
  const memory = (performance as Performance & {
    memory?: MemorySnapshot;
  }).memory
  if (!memory) return undefined
  return {
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
    jsHeapSizeLimit: memory.jsHeapSizeLimit,
  }
}

export function collectReplaySample (
  graph: Graph,
  step: string,
  replayStart: number,
  options: {
    graphHost: HTMLElement;
    wallFpsLatest: number;
    renderFps?: number;
  }
): ReplaySample {
  const snap = graph.getGpuTimings() as GpuTimingSnapshot | null
  return {
    t: performance.now() - replayStart,
    step,
    wallFps: options.wallFpsLatest,
    renderFps: Number.isFinite(options.renderFps) ? options.renderFps ?? null : null,
    gpuFrameMs: estimateGpuFrameMs(snap, graph),
    dpr: effectiveDpr(options.graphHost),
    alpha: graph.progress,
    simulationRunning: graph.isSimulationRunning,
    pacing: graph.getFramePacingStats(),
    memory: memorySnapshot(),
  }
}

export function summarizeReplayStep (name: string, durationMs: number, samples: ReplaySample[]): ReplayStepSummary {
  const stepSamples = samples.filter(sample => sample.step === name)
  return {
    name,
    durationMs,
    samples: stepSamples.length,
    wallFpsMedian: median(stepSamples.map(sample => sample.wallFps).filter(Number.isFinite)),
    gpuFrameMsMedian: median(stepSamples.map(sample => sample.gpuFrameMs).filter(ms => Number.isFinite(ms) && ms > 0)),
    dprMedian: median(stepSamples.map(sample => sample.dpr).filter(Number.isFinite)),
    skipRatioMax: Math.max(0, ...stepSamples.map(sample => sample.pacing.skipRatio).filter(Number.isFinite)),
  }
}
