import { Graph, type GraphConfig, type GpuTimingSnapshot } from '@kajillion/graph'
import { generateBA, type GeneratedGraph } from './generate-graph'

interface BenchParams {
  nodeCount: number;
  edgesPerNode: number;
  seed: number;
  warmupMs: number;
  measureMs: number;
  pixelRatio: number | undefined;
  label: string | undefined;
  repeat: number;
  zoomLevel: number | undefined;
}

interface PassStats {
  median: number;
  min: number;
  max: number;
  samples: number[];
}

type AggregateSnapshot = Record<string, PassStats>

function readParams (): BenchParams {
  const u = new URL(window.location.href)
  const pr = u.searchParams.get('pixelRatio')
  const label = u.searchParams.get('label')
  return {
    nodeCount: Number(u.searchParams.get('n') ?? '100000'),
    edgesPerNode: Number(u.searchParams.get('m') ?? '3'),
    seed: Number(u.searchParams.get('seed') ?? '42'),
    warmupMs: Number(u.searchParams.get('warmup') ?? '2000'),
    measureMs: Number(u.searchParams.get('measure') ?? '8000'),
    pixelRatio: pr === null || pr === '' ? undefined : Number(pr),
    label: label === null || label === '' ? undefined : label,
    repeat: Math.max(1, Number(u.searchParams.get('repeat') ?? '1')),
    zoomLevel: ((): number | undefined => {
      const z = u.searchParams.get('zoomLevel')
      return z === null || z === '' ? undefined : Number(z)
    })(),
  }
}

async function postResults (payload: unknown): Promise<void> {
  try {
    const headers = new Headers()
    headers.set('Content-Type', 'application/json')
    const res = await fetch('/record-result', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    if (!res.ok) console.warn('record-result failed:', res.status)
  } catch (err) {
    console.warn('record-result error:', err)
  }
}

function formatMs (ms: number): string {
  if (ms < 0.01) return '< 0.01 ms'
  return `${ms.toFixed(3)} ms`
}

function median (values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
    : sorted[mid] as number
}

function aggregate (snapshots: GpuTimingSnapshot[]): AggregateSnapshot {
  const labels = new Set<string>()
  for (const s of snapshots) for (const k of Object.keys(s)) labels.add(k)
  const out: AggregateSnapshot = {}
  for (const label of labels) {
    const samples: number[] = []
    for (const s of snapshots) {
      const t = s[label]
      if (t !== undefined) samples.push(t.avgMs)
    }
    out[label] = {
      median: median(samples),
      min: Math.min(...samples),
      max: Math.max(...samples),
      samples,
    }
  }
  return out
}

function deriveFps (rawSnapshots: GpuTimingSnapshot[], measureMs: number): number {
  // Render passes run every render frame; force passes run only when sim is active.
  // FPS = render-pass sample count / measure window in seconds.
  const renderCounts = rawSnapshots.map(s => {
    const candidates = ['render.points', 'render.lines'].map(k => s[k]?.sampleCount ?? 0)
    return Math.max(...candidates, 0)
  })
  const medianCount = median(renderCounts)
  return medianCount * 1000 / measureMs
}

function renderResults (
  agg: AggregateSnapshot,
  container: HTMLElement,
  params: BenchParams,
  data: GeneratedGraph,
  rawSnapshots: GpuTimingSnapshot[]
): void {
  const entries = Object.entries(agg).sort((a, b) => b[1].median - a[1].median)
  const totalMedian = entries.reduce((s, [, t]) => s + t.median, 0)
  const fps = deriveFps(rawSnapshots, params.measureMs)
  const msPerFrame = fps > 0 ? 1000 / fps : 0
  const rows = entries.map(([label, t]) => `
    <tr>
      <td>${label}</td>
      <td style="text-align:right">${formatMs(t.median)}</td>
      <td style="text-align:right">${formatMs(t.min)}</td>
      <td style="text-align:right">${formatMs(t.max)}</td>
      <td style="text-align:right">${t.samples.length}</td>
    </tr>
  `).join('')
  const nodes = data.nodeCount.toLocaleString()
  const edges = data.edgeCount.toLocaleString()
  const datasetLine = `${nodes} nodes &middot; ${edges} edges (Barabási–Albert, m=${params.edgesPerNode}, seed=${params.seed})`
  const rawJson = JSON.stringify({
    params,
    dataset: { nodeCount: data.nodeCount, edgeCount: data.edgeCount },
    derived: { renderFps: fps, msPerRenderFrame: msPerFrame },
    aggregate: agg,
    runs: rawSnapshots,
  }, null, 2)
  const fallbackRow = '<tr><td colspan="5"><em>No samples — extension unsupported on this browser?</em></td></tr>'

  container.innerHTML = `
    <h2>Baseline result</h2>
    <p><strong>Dataset:</strong> ${datasetLine}</p>
    <p><strong>Window:</strong> ${params.repeat} run(s) of ${params.measureMs} ms measurement after ${params.warmupMs} ms warmup</p>
    <p><strong>Render FPS (median across runs):</strong> ${fps.toFixed(1)} fps &middot; ${formatMs(msPerFrame)} per render frame</p>
    <p><strong>Sum of per-pass medians:</strong> ${formatMs(totalMedian)}
      <em>(reference only — passes don't all run every frame)</em></p>
    <table>
      <thead>
        <tr><th>Pass</th><th>Median (ms)</th><th>Min (ms)</th><th>Max (ms)</th><th>Runs</th></tr>
      </thead>
      <tbody>${rows || fallbackRow}</tbody>
    </table>
    <details>
      <summary>Raw JSON</summary>
      <pre>${rawJson}</pre>
    </details>
  `
}

function delay (ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function runOnce (
  data: GeneratedGraph,
  graphDiv: HTMLDivElement,
  params: BenchParams,
  status: HTMLElement,
  runIdx: number
): Promise<GpuTimingSnapshot> {
  const config: GraphConfig = {
    spaceSize: 4096,
    backgroundColor: '#0f1115',
    pointDefaultColor: '#7fb3ff',
    pointDefaultSize: 2,
    linkDefaultColor: '#2c3e63',
    linkDefaultWidth: 0.5,
    linkOpacity: 0.5,
    renderLinks: true,
    curvedLinks: false,
    fitViewOnInit: true,
    enableSimulation: true,
    simulationFriction: 0.85,
    simulationRepulsion: 0.5,
    simulationGravity: 0.1,
    enableGpuTimings: true,
  }
  if (params.pixelRatio !== undefined) config.pixelRatio = params.pixelRatio
  if (params.zoomLevel !== undefined) {
    config.fitViewOnInit = false
    config.initialZoomLevel = params.zoomLevel
  }

  const graph = new Graph(graphDiv, config)
  await graph.ready
  graph.setPointPositions(data.positions)
  graph.setLinks(data.links)
  graph.render()

  const tag = params.repeat > 1 ? ` [run ${runIdx + 1}/${params.repeat}]` : ''
  status.textContent = `Engine ready${tag}. Warmup (${params.warmupMs} ms)…`
  await delay(params.warmupMs)
  graph.resetGpuTimings()
  status.textContent = `Measuring${tag} (${params.measureMs} ms)…`
  await delay(params.measureMs)
  const snapshot = graph.getGpuTimings() ?? {}
  graph.destroy()
  return snapshot
}

async function run (): Promise<void> {
  const params = readParams()
  const status = document.getElementById('status') as HTMLElement
  const graphDiv = document.getElementById('graph') as HTMLDivElement
  const resultsDiv = document.getElementById('results') as HTMLElement

  status.textContent = `Generating BA graph (n=${params.nodeCount}, m=${params.edgesPerNode}, seed=${params.seed})…`
  const t0 = performance.now()
  const data = generateBA(params.nodeCount, params.edgesPerNode, params.seed)
  const tGen = performance.now() - t0
  const nodes = data.nodeCount.toLocaleString()
  const edges = data.edgeCount.toLocaleString()
  status.textContent = `Generated ${nodes} nodes / ${edges} edges in ${tGen.toFixed(0)} ms. Initializing engine…`

  const snapshots: GpuTimingSnapshot[] = []
  for (let i = 0; i < params.repeat; i += 1) {
    const snap = await runOnce(data, graphDiv, params, status, i)
    snapshots.push(snap)
  }

  const agg = aggregate(snapshots)
  status.textContent = 'Done.'
  renderResults(agg, resultsDiv, params, data, snapshots)
  console.log('[kajillion-bench] aggregate', agg)
  await postResults({
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    devicePixelRatio: window.devicePixelRatio,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    params,
    dataset: { nodeCount: data.nodeCount, edgeCount: data.edgeCount },
    aggregate: agg,
    runs: snapshots,
  })
}

run().catch(err => {
  const status = document.getElementById('status')
  if (status) status.textContent = `Error: ${(err as Error).message}`
  // eslint-disable-next-line no-console
  console.error(err)
})
