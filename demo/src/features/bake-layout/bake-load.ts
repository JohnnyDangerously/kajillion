import { Graph, type GraphConfig } from '@kajillion/graph'
import { decodeBaked, encodeBaked } from '../../baked-format'
import { galleryRenderData } from '../../gallery-presets'
import type { GeneratedGraph } from '../../generate-graph'
import type { RenderableGraphData } from '../../graph-contract'
import type { ControlElements } from '../control-plane/dom'
import type { DemoConfig } from '../control-plane/types'
import { delay, downloadBlob } from '../replay-bench/metrics'

export interface BakeLoadBusyState {
  bake: boolean;
  load: boolean;
  replay: boolean;
}

export interface BakeLoadRuntime {
  graphHost: HTMLDivElement;
  spaceSize: number;
  getCurrentConfig: () => DemoConfig;
  getCurrentData: () => GeneratedGraph | null;
  getCurrentGraph: () => Graph | null;
  setCurrentGraph: (graph: Graph | null) => void;
  setCurrentData: (data: GeneratedGraph) => void;
  setCurrentRenderData: (data: GeneratedGraph) => void;
  buildGraphConfig: (cfg: DemoConfig) => GraphConfig;
  buildVisualAttributes: (data: GeneratedGraph | RenderableGraphData) => {
    pointColors: Float32Array;
    pointSizes: Float32Array;
    linkColors: Float32Array;
    linkWidths: Float32Array;
  };
  setMetaNodeCount: (text: string) => void;
  exposeDebugGraph: (graph: Graph) => void;
  setBusy: (kind: keyof BakeLoadBusyState, busy: boolean) => void;
  updateBusyButtons: () => void;
}

export function updateBakeLoadButtons (ctlEl: ControlElements, busyState: BakeLoadBusyState): void {
  const busy = busyState.bake || busyState.load || busyState.replay
  ctlEl.bake.disabled = busy
  ctlEl.load.disabled = busy
  ctlEl.replay.disabled = busy
}

export function isHtmlFallbackResponse (buf: ArrayBuffer, contentType: string): boolean {
  if (contentType.toLowerCase().includes('text/html')) return true
  if (buf.byteLength < 4) return false
  const bytes = new Uint8Array(buf, 0, 4)
  return bytes[0] === 0x3c && bytes[1] === 0x21 && bytes[2] === 0x64 && bytes[3] === 0x6f
}

export async function bakeCurrentLayout (
  ctlEl: ControlElements,
  runtime: BakeLoadRuntime
): Promise<void> {
  const graph = runtime.getCurrentGraph()
  const data = runtime.getCurrentData()
  if (!graph || !data) {
    ctlEl.bakeStatus.textContent = 'no graph loaded'
    return
  }
  runtime.setBusy('bake', true)
  runtime.updateBusyButtons()
  ctlEl.loadStatus.textContent = 'load disabled while baking'
  const label = ctlEl.bakeLabel.value.trim() || 'default'
  const pointsOnly = ctlEl.bakePointsOnly.checked
  try {
    graph.start(1)
    const settleDeadline = performance.now() + 90_000
    while (graph.isSimulationRunning && performance.now() < settleDeadline) {
      ctlEl.bakeStatus.textContent = `settling... progress ${graph.progress.toFixed(3)}`
      await delay(200)
    }
    if (graph.isSimulationRunning) {
      ctlEl.bakeStatus.textContent = 'warning: sim still running at 90 s, baking mid-state'
    } else {
      ctlEl.bakeStatus.textContent = 'settled · reading back...'
    }
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    const positions = await graph.readbackPointPositions()
    if (positions.length === 0) {
      ctlEl.bakeStatus.textContent = 'error: empty readback (WebGPU only)'
      return
    }
    const blob = encodeBaked({
      nodeCount: data.nodeCount,
      edgeCount: pointsOnly ? 0 : data.edgeCount,
      positions,
      links: pointsOnly ? new Float32Array(0) : data.links,
    })
    const totalMb = (blob.byteLength / (1024 * 1024)).toFixed(2)
    ctlEl.bakeStatus.textContent = `uploading ${totalMb} MB...`
    const headers = new Headers()
    headers.set('Content-Type', 'application/octet-stream')
    try {
      const resp = await fetch(`/bake?label=${encodeURIComponent(label)}`, {
        method: 'POST',
        headers,
        body: blob,
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`)
      const json = await resp.json() as { savedTo: string; bytes: number }
      ctlEl.bakeStatus.textContent = `saved · ${json.savedTo.split('/').pop()} · ${(json.bytes / (1024 * 1024)).toFixed(2)} MB`
      ctlEl.loadStatus.textContent = `ready · baked-${label}.bin`
    } catch {
      downloadBlob(new Blob([blob], { type: 'application/octet-stream' }), `baked-${label}.bin`)
      ctlEl.bakeStatus.textContent = `downloaded · ${(blob.byteLength / (1024 * 1024)).toFixed(2)} MB`
      ctlEl.loadStatus.textContent = 'ready after placing downloaded file in demo/public'
    }
  } catch (err) {
    ctlEl.bakeStatus.textContent = `error: ${(err as Error).message}`
  } finally {
    runtime.setBusy('bake', false)
    runtime.updateBusyButtons()
  }
}

export async function loadBakedLayout (
  ctlEl: ControlElements,
  runtime: BakeLoadRuntime
): Promise<void> {
  const label = ctlEl.bakeLabel.value.trim() || 'default'
  runtime.setBusy('load', true)
  runtime.updateBusyButtons()
  try {
    ctlEl.loadStatus.textContent = `fetching baked-${label}.bin...`
    const resp = await fetch(`/baked-${encodeURIComponent(label)}.bin`)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const buf = await resp.arrayBuffer()
    const contentType = resp.headers.get('Content-Type') ?? ''
    if (isHtmlFallbackResponse(buf, contentType)) {
      throw new Error(`no baked layout named "${label}"`)
    }
    const layout = decodeBaked(buf)
    ctlEl.loadStatus.textContent = `decoded: ${layout.nodeCount.toLocaleString()} nodes, ${layout.edgeCount.toLocaleString()} edges. Rendering...`

    if (runtime.getCurrentGraph()) {
      try { runtime.getCurrentGraph()?.destroy() } catch { /* ignore */ }
      runtime.setCurrentGraph(null)
    }
    runtime.graphHost.innerHTML = ''
    const cfg: DemoConfig = { ...runtime.getCurrentConfig(), sim: false }
    const graph = new Graph(runtime.graphHost, runtime.buildGraphConfig(cfg))
    await graph.ready
    const loadedData = {
      positions: layout.positions,
      links: layout.links,
      nodeCount: layout.nodeCount,
      edgeCount: layout.edgeCount,
    }
    const renderData = galleryRenderData(runtime.getCurrentConfig().palette, loadedData, runtime.spaceSize)
    const visual = runtime.buildVisualAttributes(renderData)
    graph.setPointPositions(renderData.positions, true)
    graph.setPointColors(visual.pointColors)
    graph.setPointSizes(visual.pointSizes)
    if (layout.edgeCount > 0) graph.setLinks(renderData.links)
    if (layout.edgeCount > 0) graph.setLinkColors(visual.linkColors)
    if (layout.edgeCount > 0) graph.setLinkWidths(visual.linkWidths)
    graph.render()
    runtime.setCurrentGraph(graph)
    runtime.setCurrentData(loadedData)
    runtime.setCurrentRenderData(renderData)
    runtime.setMetaNodeCount(`${layout.nodeCount.toLocaleString()} (baked)`)
    runtime.exposeDebugGraph(graph)
    ctlEl.loadStatus.textContent = `loaded · ${(buf.byteLength / (1024 * 1024)).toFixed(2)} MB`
  } catch (err) {
    ctlEl.loadStatus.textContent = `error: ${(err as Error).message}`
  } finally {
    runtime.setBusy('load', false)
    runtime.updateBusyButtons()
  }
}

export function installBakeLoadControls (
  ctlEl: ControlElements,
  runtime: BakeLoadRuntime
): void {
  ctlEl.bake.addEventListener('click', () => {
    if (ctlEl.bake.disabled) return
    bakeCurrentLayout(ctlEl, runtime).catch(err => console.error(err))
  })
  ctlEl.load.addEventListener('click', () => {
    if (ctlEl.load.disabled) return
    loadBakedLayout(ctlEl, runtime).catch(err => console.error(err))
  })
}
