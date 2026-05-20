import type { Graph } from '@kajillion/graph'
import type { GeneratedGraph } from '../../generate-graph'
import type { ControlElements } from '../control-plane/dom'
import type { DemoConfig } from '../control-plane/types'
import { delay, downloadBlob, percentile } from './metrics'
import { dispatchMouseMoveInGraph, findNearestPointIndex, pointPositionForIndex } from './replay-geometry'
import { runMeasuredReplayStep } from './replay-step'
import type { ReplaySample, ReplayStepSummary } from './types'

export interface ReplayCaptureRuntime {
  graphHost: HTMLDivElement;
  getCurrentGraph: () => Graph | null;
  getCurrentData: () => GeneratedGraph | null;
  getCurrentConfig: () => DemoConfig;
  getWallFpsLatest: () => number;
  getRenderFps: () => number | undefined;
  setReplayBusy: (busy: boolean) => void;
  updateBusyButtons: () => void;
}

export async function runReplayCapture (
  ctlEl: ControlElements,
  runtime: ReplayCaptureRuntime,
  spaceSize: number
): Promise<unknown> {
  const graph = runtime.getCurrentGraph()
  const data = runtime.getCurrentData()
  if (!graph || !data) {
    ctlEl.replayStatus.textContent = 'no graph loaded'
    return null
  }

  runtime.setReplayBusy(true)
  ctlEl.record.disabled = true
  runtime.updateBusyButtons()
  const status = (s: string): void => { ctlEl.replayStatus.textContent = s }
  const samples: ReplaySample[] = []
  const summaries: ReplayStepSummary[] = []
  const replayStart = performance.now()
  const focusA = findNearestPointIndex(data, 0.30, 0.53, spaceSize)
  const focusB = findNearestPointIndex(data, 0.72, 0.46, spaceSize)
  const hostRect = runtime.graphHost.getBoundingClientRect()

  try {
    status('warming...')
    graph.clearDebugFrameTrace()
    graph.resetGpuTimings()
    await delay(800)

    summaries.push(await runMeasuredReplayStep(
      runtime,
      graph,
      'overview-fit',
      900,
      samples,
      replayStart,
      async (_elapsed, progress) => {
        if (progress === 0) graph.setZoomTransformByPointPositions(data.positions, 520, undefined, 0.14, false)
      },
      status
    ))

    summaries.push(await runMeasuredReplayStep(
      runtime,
      graph,
      'focus-left-community',
      1000,
      samples,
      replayStart,
      async (_elapsed, progress) => {
        if (progress === 0) graph.setZoomTransformByPointPositions(pointPositionForIndex(data, focusA, spaceSize), 560, 2.8, 0.16, false)
      },
      status
    ))

    summaries.push(await runMeasuredReplayStep(
      runtime,
      graph,
      'hover-sweep',
      1400,
      samples,
      replayStart,
      (_elapsed, progress) => {
        const x = hostRect.width * (0.24 + 0.52 * progress)
        const y = hostRect.height * (0.40 + 0.16 * Math.sin(progress * Math.PI * 2))
        dispatchMouseMoveInGraph(runtime.graphHost, x, y)
      },
      status
    ))

    summaries.push(await runMeasuredReplayStep(
      runtime,
      graph,
      'focus-right-community',
      1000,
      samples,
      replayStart,
      async (_elapsed, progress) => {
        if (progress === 0) graph.setZoomTransformByPointPositions(pointPositionForIndex(data, focusB, spaceSize), 560, 3.4, 0.16, false)
      },
      status
    ))

    summaries.push(await runMeasuredReplayStep(
      runtime,
      graph,
      'return-overview',
      900,
      samples,
      replayStart,
      async (_elapsed, progress) => {
        if (progress === 0) graph.setZoomTransformByPointPositions(data.positions, 520, undefined, 0.14, false)
      },
      status
    ))

    const gpuTimings = graph.getGpuTimings() ?? {}
    const payload = {
      schemaVersion: 1,
      label: 'deterministic-replay',
      timestamp: new Date().toISOString(),
      ua: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      config: runtime.getCurrentConfig(),
      graph: { nodeCount: data.nodeCount, edgeCount: data.edgeCount },
      protocol: {
        sampleIntervalMs: 200,
        steps: summaries.map(({ name, durationMs }) => ({ name, durationMs })),
        focusIndices: [focusA, focusB],
      },
      summary: {
        wallFpsP50: percentile(samples.map(sample => sample.wallFps), 50),
        wallFpsP05: percentile(samples.map(sample => sample.wallFps), 5),
        gpuFrameMsP50: percentile(samples.map(sample => sample.gpuFrameMs).filter(ms => ms > 0), 50),
        gpuFrameMsP95: percentile(samples.map(sample => sample.gpuFrameMs).filter(ms => ms > 0), 95),
        maxSkipRatio: Math.max(0, ...samples.map(sample => sample.pacing.skipRatio)),
        dprMin: Math.min(...samples.map(sample => sample.dpr)),
        dprMax: Math.max(...samples.map(sample => sample.dpr)),
      },
      steps: summaries,
      samples,
      gpuTimings,
      debugFrameTraceTail: graph.getDebugFrameTrace().slice(-240),
    }

    const body = JSON.stringify(payload, null, 2)
    status('uploading replay...')
    try {
      const resp = await fetch('/record-replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const json = await resp.json() as { savedTo: string }
      status(`saved · ${json.savedTo.split('/').slice(-2).join('/')}`)
    } catch {
      downloadBlob(new Blob([body], { type: 'application/json' }), `kajillion-replay-${payload.timestamp}.json`)
      status('downloaded replay json')
    }
    return payload
  } catch (err) {
    status(`error: ${(err as Error).message}`)
    throw err
  } finally {
    runtime.setReplayBusy(false)
    ctlEl.record.disabled = false
    runtime.updateBusyButtons()
  }
}

export function installReplayCapture (
  ctlEl: ControlElements,
  runtime: ReplayCaptureRuntime,
  spaceSize: number
): () => Promise<unknown> {
  const runner = (): Promise<unknown> => runReplayCapture(ctlEl, runtime, spaceSize)
  ctlEl.replay.addEventListener('click', () => { runner().catch(err => console.error(err)) })
  return runner
}
