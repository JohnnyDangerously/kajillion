import { Graph, type GpuTimingSnapshot, type GraphConfig } from '@kajillion/graph'
import { galleryRenderData } from '../../gallery-presets'
import type { GeneratedGraph } from '../../generate-graph'
import type { RenderableGraphData } from '../../graph-contract'
import { isWorkMode } from '../work-mode'
import type { ControlElements } from '../control-plane/dom'
import type { DemoConfig } from '../control-plane/types'
import { aggregateGpu, delay, downloadBlob, measureWallFps, median } from './metrics'
import type { BaselineRun } from './types'

export interface BaselineRecorderRuntime {
  graphHost: HTMLDivElement;
  spaceSize: number;
  getCurrentConfig: () => DemoConfig;
  getCurrentData: () => GeneratedGraph | null;
  getCurrentGraph: () => Graph | null;
  setCurrentGraph: (graph: Graph | null) => void;
  buildGraphConfig: (cfg: DemoConfig) => GraphConfig;
  buildVisualAttributes: (data: GeneratedGraph | RenderableGraphData) => {
    pointColors: Float32Array;
    pointSizes: Float32Array;
    linkColors: Float32Array;
    linkWidths: Float32Array;
  };
  rebuildGraph: (cfg: DemoConfig) => Promise<void>;
}

async function recordSingleRun (
  runtime: BaselineRecorderRuntime,
  data: GeneratedGraph,
  cfg: DemoConfig,
  warmupMs: number,
  measureMs: number,
  status: (s: string) => void
): Promise<BaselineRun> {
  if (runtime.getCurrentGraph()) {
    try { runtime.getCurrentGraph()?.destroy() } catch { /* ignore */ }
    runtime.setCurrentGraph(null)
  }
  runtime.graphHost.innerHTML = ''
  const graph = new Graph(runtime.graphHost, runtime.buildGraphConfig(cfg))
  runtime.setCurrentGraph(graph)
  await graph.ready
  const renderData = galleryRenderData(cfg.palette, data, runtime.spaceSize)
  const visual = runtime.buildVisualAttributes(renderData)
  graph.setPointPositions(renderData.positions, isWorkMode(cfg) || renderData !== data)
  graph.setPointColors(visual.pointColors)
  graph.setPointSizes(visual.pointSizes)
  graph.setLinks(renderData.links)
  graph.setLinkColors(visual.linkColors)
  graph.setLinkWidths(visual.linkWidths)
  graph.render()

  status(`warmup ${warmupMs} ms...`)
  await delay(warmupMs)
  graph.resetGpuTimings()

  status(`measuring active ${measureMs} ms...`)
  const wallFpsActive = await measureWallFps(measureMs)
  const gpuTimings = graph.getGpuTimings() ?? {}

  status('waiting for settle...')
  const settleDeadline = performance.now() + 6000
  while (graph.isSimulationRunning && performance.now() < settleDeadline) {
    await delay(100)
  }
  let wallFpsIdle = 0
  if (!graph.isSimulationRunning) {
    status('measuring idle 2000 ms...')
    wallFpsIdle = await measureWallFps(2000)
  }

  return { wallFps: wallFpsActive, wallFpsIdle, gpuTimings: gpuTimings as GpuTimingSnapshot }
}

export async function recordBaseline (
  ctlEl: ControlElements,
  runtime: BaselineRecorderRuntime
): Promise<void> {
  ctlEl.record.disabled = true
  const cfg = runtime.getCurrentConfig()
  const data = runtime.getCurrentData()
  if (!data) {
    ctlEl.recordStatus.textContent = 'no graph loaded'
    ctlEl.record.disabled = false
    return
  }
  const repeats = 5
  const warmupMs = 2000
  const measureMs = 8000

  const status = (s: string): void => { ctlEl.recordStatus.textContent = s }
  const runs: BaselineRun[] = []
  try {
    for (let i = 0; i < repeats; i += 1) {
      status(`run ${i + 1}/${repeats}: starting`)
      const r = await recordSingleRun(runtime, data, cfg, warmupMs, measureMs, (s) => {
        status(`run ${i + 1}/${repeats}: ${s}`)
      })
      runs.push(r)
    }

    const payload = {
      schemaVersion: 1,
      label: 'baseline',
      timestamp: new Date().toISOString(),
      ua: navigator.userAgent,
      config: cfg,
      graph: { nodeCount: data.nodeCount, edgeCount: data.edgeCount },
      protocol: { repeats, warmupMs, measureMs },
      wallFps: {
        active: { median: median(runs.map(r => r.wallFps)), runs: runs.map(r => r.wallFps) },
        idle: { median: median(runs.map(r => r.wallFpsIdle)), runs: runs.map(r => r.wallFpsIdle) },
      },
      gpuTimings: aggregateGpu(runs),
    }
    status('uploading...')
    const headers = new Headers()
    headers.set('Content-Type', 'application/json')
    const body = JSON.stringify(payload, null, 2)
    try {
      const resp = await fetch('/record-baseline', {
        method: 'POST',
        headers,
        body,
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const json = await resp.json() as { savedTo: string }
      status(`saved · ${json.savedTo.split('/').slice(-2).join('/')}`)
    } catch {
      downloadBlob(new Blob([body], { type: 'application/json' }), `kajillion-baseline-${payload.timestamp}.json`)
      status('downloaded baseline json')
    }
  } catch (err) {
    status(`error: ${(err as Error).message}`)
  } finally {
    ctlEl.record.disabled = false
    runtime.rebuildGraph(runtime.getCurrentConfig()).catch(err => console.error(err))
  }
}

export function installBaselineRecorder (
  ctlEl: ControlElements,
  runtime: BaselineRecorderRuntime
): void {
  ctlEl.record.addEventListener('click', () => {
    recordBaseline(ctlEl, runtime).catch(err => console.error(err))
  })
}
