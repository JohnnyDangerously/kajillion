import { Graph, type GraphConfig, type GpuTimingSnapshot } from '@kajillion/graph'
import { generateBA, type GeneratedGraph } from './generate-graph'

interface DemoConfig {
  n: number;
  seed: number;
  webgpu: boolean;
  msaa: boolean;
  adaptiveDpr: boolean;
  blend: 'add' | 'normal';
  sim: boolean;
}

type GpuStat = { median: number; min: number; max: number; samples: number }

const overlayEl = {
  metaN: document.getElementById('meta-n') as HTMLElement,
  wall: document.getElementById('m-wall') as HTMLElement,
  idle: document.getElementById('m-idle') as HTMLElement,
  quad: document.getElementById('m-quad') as HTMLElement,
  rep: document.getElementById('m-rep') as HTMLElement,
  link: document.getElementById('m-link') as HTMLElement,
  grav: document.getElementById('m-grav') as HTMLElement,
  canvas: document.getElementById('m-canvas') as HTMLElement,
  lines: document.getElementById('m-lines') as HTMLElement,
  points: document.getElementById('m-points') as HTMLElement,
  alpha: document.getElementById('m-alpha') as HTMLElement,
  dpr: document.getElementById('m-dpr') as HTMLElement,
}

const ctlEl = {
  n: document.getElementById('c-n') as HTMLSelectElement,
  seed: document.getElementById('c-seed') as HTMLInputElement,
  webgpu: document.getElementById('c-webgpu') as HTMLInputElement,
  msaa: document.getElementById('c-msaa') as HTMLInputElement,
  adpr: document.getElementById('c-adpr') as HTMLInputElement,
  blend: document.getElementById('c-blend') as HTMLSelectElement,
  sim: document.getElementById('c-sim') as HTMLInputElement,
  record: document.getElementById('btn-record') as HTMLButtonElement,
  recordStatus: document.getElementById('record-status') as HTMLElement,
}

const graphHost = document.getElementById('graph') as HTMLDivElement

function readControls (): DemoConfig {
  return {
    n: parseInt(ctlEl.n.value, 10),
    seed: parseInt(ctlEl.seed.value, 10) || 42,
    webgpu: ctlEl.webgpu.checked,
    msaa: ctlEl.msaa.checked,
    adaptiveDpr: ctlEl.adpr.checked,
    blend: ctlEl.blend.value === 'normal' ? 'normal' : 'add',
    sim: ctlEl.sim.checked,
  }
}

function buildGraphConfig (cfg: DemoConfig): GraphConfig {
  const c: GraphConfig = {
    spaceSize: 4096,
    backgroundColor: '#0a0c10',
    pointDefaultColor: '#7fb3ff',
    pointDefaultSize: 2,
    linkDefaultColor: '#2c3e63',
    linkDefaultWidth: 0.5,
    linkOpacity: 0.5,
    renderLinks: true,
    curvedLinks: false,
    fitViewOnInit: true,
    enableSimulation: cfg.sim,
    simulationFriction: 0.85,
    simulationRepulsion: 0.5,
    simulationGravity: 0.1,
    enableGpuTimings: true,
    linkBlendMode: cfg.blend,
    useWebGPU: cfg.webgpu,
    adaptivePixelRatio: cfg.adaptiveDpr,
    msaa: cfg.msaa ? 4 : 1,
  }
  return c
}

// Rolling wall-fps probe: count rAF callbacks per 500 ms window. Used by both
// the live overlay and the baseline recorder (the recorder integrates over the
// full measurement window instead of using these samples).
class WallFps {
  public latest = 0
  public peakWhenIdle = 0
  private count = 0
  private windowStart = performance.now()
  private isActive = true

  public start (): void {
    const tick = (): void => {
      if (!this.isActive) return
      this.count += 1
      const now = performance.now()
      const dt = now - this.windowStart
      if (dt >= 500) {
        this.latest = (this.count * 1000) / dt
        this.count = 0
        this.windowStart = now
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  public stop (): void { this.isActive = false }
}

function fmtMs (s?: GpuStat): string {
  if (!s || s.samples === 0) return '—'
  return `${s.median.toFixed(2)} ms`
}

function effectiveDpr (host: HTMLDivElement): number {
  const canvas = host.querySelector('canvas')
  if (!canvas) return window.devicePixelRatio
  const rect = canvas.getBoundingClientRect()
  if (rect.width === 0) return window.devicePixelRatio
  return canvas.width / rect.width
}

let currentGraph: Graph | null = null
let currentData: GeneratedGraph | null = null
let currentConfig: DemoConfig = readControls()
const wallFps = new WallFps()

async function rebuildGraph (cfg: DemoConfig): Promise<void> {
  overlayEl.metaN.textContent = cfg.n.toLocaleString()
  if (currentGraph) {
    try { currentGraph.destroy() } catch { /* ignore */ }
    currentGraph = null
  }
  graphHost.innerHTML = ''

  // Generate (cache by n+seed so we only regen when needed)
  const needsRegen = !currentData || currentData.nodeCount !== cfg.n
  if (needsRegen) {
    currentData = generateBA(cfg.n, 3, cfg.seed)
  }
  const data = currentData!

  const graph = new Graph(graphHost, buildGraphConfig(cfg))
  await graph.ready
  graph.setPointPositions(data.positions)
  graph.setLinks(data.links)
  graph.render()
  currentGraph = graph
  // Expose for ad-hoc debugging (browser console, e2e probes). The demo is
  // explicitly a debug surface; no need to gate this.
  ;(window as unknown as { __demoGraph: Graph }).__demoGraph = graph
}

async function applyControlChange (): Promise<void> {
  // Any change triggers a rebuild — simplifies state management at the cost
  // of a re-init. n=100k re-init takes ~200 ms which is fine for a control.
  currentConfig = readControls()
  await rebuildGraph(currentConfig)
}

;[ctlEl.n, ctlEl.seed, ctlEl.webgpu, ctlEl.msaa, ctlEl.adpr, ctlEl.blend, ctlEl.sim]
  .forEach(el => el.addEventListener('change', () => { applyControlChange().catch(err => console.error(err)) }))

function paintOverlay (): void {
  const g = currentGraph
  if (!g) {
    overlayEl.wall.textContent = '—'
    return
  }
  const snap = g.getGpuTimings() as GpuTimingSnapshot | null
  overlayEl.wall.textContent = `${wallFps.latest.toFixed(1)} fps`
  if (!g.isSimulationRunning && wallFps.latest > 30) {
    wallFps.peakWhenIdle = Math.max(wallFps.peakWhenIdle, wallFps.latest)
  }
  overlayEl.idle.textContent = wallFps.peakWhenIdle > 0 ? `${wallFps.peakWhenIdle.toFixed(1)} fps` : '—'
  overlayEl.quad.textContent = fmtMs(snap?.['force.quadtree.build'] as GpuStat | undefined)
  overlayEl.rep.textContent = fmtMs(snap?.['force.repulsion'] as GpuStat | undefined)
  const lin = snap?.['force.link.incoming'] as GpuStat | undefined
  const lout = snap?.['force.link.outgoing'] as GpuStat | undefined
  const linMs = lin && lin.samples > 0 ? lin.median : 0
  const loutMs = lout && lout.samples > 0 ? lout.median : 0
  overlayEl.link.textContent = (linMs + loutMs) > 0 ? `${(linMs + loutMs).toFixed(2)} ms` : '—'
  overlayEl.grav.textContent = fmtMs(snap?.['force.gravity'] as GpuStat | undefined)
  overlayEl.canvas.textContent = fmtMs(snap?.['render.canvas'] as GpuStat | undefined)
  overlayEl.lines.textContent = fmtMs(snap?.['render.lines'] as GpuStat | undefined)
  overlayEl.points.textContent = fmtMs(snap?.['render.points'] as GpuStat | undefined)
  overlayEl.alpha.textContent = `${g.progress.toFixed(3)}${g.isSimulationRunning ? '' : ' (settled)'}`
  overlayEl.dpr.textContent = effectiveDpr(graphHost).toFixed(2)
}

function startOverlayLoop (): void {
  const loop = (): void => {
    paintOverlay()
    setTimeout(loop, 250)
  }
  loop()
}

/* ────────────────────────────  Baseline recorder  ────────────────────────── */

interface BaselineRun {
  wallFps: number;
  wallFpsIdle: number;
  gpuTimings: GpuTimingSnapshot;
}

function delay (ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function measureWallFps (windowMs: number): Promise<number> {
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

async function recordSingleRun (
  data: GeneratedGraph,
  cfg: DemoConfig,
  warmupMs: number,
  measureMs: number,
  status: (s: string) => void
): Promise<BaselineRun> {
  // Tear down current graph + create a fresh one for clean timing buckets.
  if (currentGraph) {
    try { currentGraph.destroy() } catch { /* ignore */ }
    currentGraph = null
  }
  graphHost.innerHTML = ''
  const graph = new Graph(graphHost, buildGraphConfig(cfg))
  currentGraph = graph
  await graph.ready
  graph.setPointPositions(data.positions)
  graph.setLinks(data.links)
  graph.render()

  status(`warmup ${warmupMs} ms…`)
  await delay(warmupMs)
  graph.resetGpuTimings()

  // Active-sim wall fps over measureMs.
  status(`measuring active ${measureMs} ms…`)
  const wallFpsActive = await measureWallFps(measureMs)
  const gpuTimings = graph.getGpuTimings() ?? {}

  // Idle wall fps: wait a bit past settle, then measure again. Cap at 6 s of
  // additional wait — if sim hasn't settled by then, surface 0 for idle.
  status('waiting for settle…')
  const settleDeadline = performance.now() + 6000
  while (graph.isSimulationRunning && performance.now() < settleDeadline) {
    await delay(100)
  }
  let wallFpsIdle = 0
  if (!graph.isSimulationRunning) {
    status('measuring idle 2000 ms…')
    wallFpsIdle = await measureWallFps(2000)
  }

  return { wallFps: wallFpsActive, wallFpsIdle, gpuTimings: gpuTimings as GpuTimingSnapshot }
}

function median (xs: number[]): number {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

function aggregateGpu (runs: BaselineRun[]): Record<string, { median: number; min: number; max: number; runs: number }> {
  const keys = new Set<string>()
  for (const r of runs) Object.keys(r.gpuTimings).forEach(k => keys.add(k))
  const out: Record<string, { median: number; min: number; max: number; runs: number }> = {}
  for (const k of keys) {
    const medians: number[] = []
    for (const r of runs) {
      const s = r.gpuTimings[k] as GpuStat | undefined
      if (s && s.samples > 0) medians.push(s.median)
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

async function recordBaseline (): Promise<void> {
  ctlEl.record.disabled = true
  const cfg = currentConfig
  const data = currentData!
  const repeats = 5
  const warmupMs = 2000
  const measureMs = 8000

  const status = (s: string): void => { ctlEl.recordStatus.textContent = s }
  const runs: BaselineRun[] = []
  try {
    for (let i = 0; i < repeats; i += 1) {
      status(`run ${i + 1}/${repeats}: starting`)
      const r = await recordSingleRun(data, cfg, warmupMs, measureMs, (s) => {
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
    status('uploading…')
    const headers = new Headers()
    headers.set('Content-Type', 'application/json')
    const resp = await fetch('/record-baseline', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const json = await resp.json() as { savedTo: string }
    status(`saved · ${json.savedTo.split('/').slice(-2).join('/')}`)
  } catch (err) {
    status(`error: ${(err as Error).message}`)
  } finally {
    ctlEl.record.disabled = false
    // Restore live-overlay graph
    rebuildGraph(currentConfig).catch(err => console.error(err))
  }
}

ctlEl.record.addEventListener('click', () => { recordBaseline().catch(err => console.error(err)) })

/* ────────────────────────────  Boot  ────────────────────────────────────── */

async function boot (): Promise<void> {
  currentConfig = readControls()
  await rebuildGraph(currentConfig)
  wallFps.start()
  startOverlayLoop()
}

boot().catch(err => console.error(err))
