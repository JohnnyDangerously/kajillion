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
  linkBlendMode: 'normal' | 'add';
  linkOpacity: number | undefined;
  pointMinPixelSize: number | undefined;
  linkMinPixelLength: number | undefined;
  useWebGPU: boolean;
  nosim: boolean;
  adaptiveDpr: boolean | undefined;
  msaa: 1 | 4;
  linkWidthScale: number | undefined;
}

interface PassStats {
  median: number;
  min: number;
  max: number;
  samples: number[];
}

type AggregateSnapshot = Record<string, PassStats>

function parseNum (raw: string | null, fallback: number, paramName: string): number {
  if (raw === null || raw === '') return fallback
  const n = Number(raw)
  if (!Number.isFinite(n)) {
    console.warn(`[bench] '${paramName}=${raw}' is not a finite number; using default ${fallback}`)
    return fallback
  }
  return n
}

function parseOptionalNum (raw: string | null, paramName: string): number | undefined {
  if (raw === null || raw === '') return undefined
  const n = Number(raw)
  if (!Number.isFinite(n)) {
    console.warn(`[bench] '${paramName}=${raw}' is not a finite number; ignoring`)
    return undefined
  }
  return n
}

function readParams (): BenchParams {
  const u = new URL(window.location.href)
  const p = u.searchParams
  const label = p.get('label')
  return {
    nodeCount: parseNum(p.get('n'), 100000, 'n'),
    edgesPerNode: parseNum(p.get('m'), 3, 'm'),
    seed: parseNum(p.get('seed'), 42, 'seed'),
    warmupMs: parseNum(p.get('warmup'), 2000, 'warmup'),
    measureMs: parseNum(p.get('measure'), 8000, 'measure'),
    pixelRatio: parseOptionalNum(p.get('pixelRatio'), 'pixelRatio'),
    label: label === null || label === '' ? undefined : label,
    repeat: Math.max(1, parseNum(p.get('repeat'), 1, 'repeat')),
    zoomLevel: parseOptionalNum(p.get('zoomLevel'), 'zoomLevel'),
    linkBlendMode: p.get('linkBlendMode') === 'add' ? 'add' : 'normal',
    linkOpacity: parseOptionalNum(p.get('linkOpacity'), 'linkOpacity'),
    pointMinPixelSize: parseOptionalNum(p.get('pointMinPixelSize'), 'pointMinPixelSize'),
    linkMinPixelLength: parseOptionalNum(p.get('linkMinPixelLength'), 'linkMinPixelLength'),
    useWebGPU: p.get('useWebGPU') === '1' || p.get('useWebGPU') === 'true',
    nosim: p.get('nosim') === '1' || p.get('nosim') === 'true',
    adaptiveDpr: p.get('adaptiveDpr') === '1' || p.get('adaptiveDpr') === 'true' ? true : undefined,
    msaa: p.get('msaa') === '4' ? 4 : 1,
    linkWidthScale: parseOptionalNum(p.get('linkWidthScale'), 'linkWidthScale'),
  }
}

async function postResults (payload: unknown): Promise<void> {
  try {
    const headers = new Headers()
    headers.set('Content-Type', 'application/json')
    // 5 s timeout: if the vite middleware stalls (disk full mid-write, etc.),
    // the bench page would otherwise hang on "Done." forever and headless
    // runners (Playwright/Puppeteer) wait on a never-resolving navigation idle.
    const ctl = new AbortController()
    const timeoutId = setTimeout(() => ctl.abort(), 5000)
    try {
      const res = await fetch('/record-result', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: ctl.signal,
      })
      if (!res.ok) console.warn('record-result failed:', res.status)
    } finally {
      clearTimeout(timeoutId)
    }
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
    if (samples.length === 0) {
      out[label] = { median: 0, min: 0, max: 0, samples }
      continue
    }
    // Explicit loop instead of Math.min/max(...samples): (a) protects against the
    // spread-arity ceiling on huge arrays, (b) avoids Infinity / -Infinity when
    // samples is somehow empty after a future refactor (Math.min(...[]) = Infinity
    // → JSON.stringify writes null → downstream tooling silently drops the field).
    let lo = samples[0] as number
    let hi = samples[0] as number
    for (let i = 1; i < samples.length; i += 1) {
      const v = samples[i] as number
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
    out[label] = {
      median: median(samples),
      min: lo,
      max: hi,
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
  rawSnapshots: GpuTimingSnapshot[],
  wallFpsList: number[]
): void {
  const entries = Object.entries(agg).sort((a, b) => b[1].median - a[1].median)
  const totalMedian = entries.reduce((s, [, t]) => s + t.median, 0)
  const fps = deriveFps(rawSnapshots, params.measureMs)
  const msPerFrame = fps > 0 ? 1000 / fps : 0
  const wallFps = median(wallFpsList)
  const wallMsPerFrame = wallFps > 0 ? 1000 / wallFps : 0
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
    derived: { renderFps: fps, msPerRenderFrame: msPerFrame, wallFps, wallMsPerFrame },
    aggregate: agg,
    runs: rawSnapshots,
    wallFps: wallFpsList,
  }, null, 2)
  const fallbackRow = '<tr><td colspan="5"><em>No samples — extension unsupported on this browser?</em></td></tr>'

  container.innerHTML = `
    <h2>Baseline result</h2>
    <p><strong>Dataset:</strong> ${datasetLine}</p>
    <p><strong>Window:</strong> ${params.repeat} run(s) of ${params.measureMs} ms measurement after ${params.warmupMs} ms warmup</p>
    <p><strong>Render FPS (GPU timer, median):</strong> ${fps.toFixed(1)} fps &middot; ${formatMs(msPerFrame)} per render frame</p>
    <p><strong>Wall-clock FPS (rAF count, median):</strong> ${wallFps.toFixed(1)} fps &middot; ${formatMs(wallMsPerFrame)} per frame</p>
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
): Promise<{ snapshot: GpuTimingSnapshot; wallFps: number }> {
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
    enableSimulation: !params.nosim,
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
  config.linkBlendMode = params.linkBlendMode
  if (params.adaptiveDpr) config.adaptivePixelRatio = true
  if (params.linkOpacity !== undefined) config.linkOpacity = params.linkOpacity
  if (params.pointMinPixelSize !== undefined) config.pointMinPixelSize = params.pointMinPixelSize
  if (params.linkMinPixelLength !== undefined) config.linkMinPixelLength = params.linkMinPixelLength
  if (params.useWebGPU) config.useWebGPU = true
  if (params.msaa === 4) config.msaa = 4
  if (params.linkWidthScale !== undefined) config.linkWidthScale = params.linkWidthScale

  /* eslint-disable no-console */
  let stage = 'construct'
  try {
    const graph = new Graph(graphDiv, config)
    stage = 'ready'
    await graph.ready
    console.log('[bench] graph ready, device.type =', (graph as unknown as {
      device?: { info?: { type?: string } };
    }).device?.info?.type)
    stage = 'setPointPositions'
    graph.setPointPositions(data.positions)
    stage = 'setLinks'
    graph.setLinks(data.links)
    stage = 'render'
    graph.render()
    console.log('[bench] render succeeded, entering warmup')

    const tag = params.repeat > 1 ? ` [run ${runIdx + 1}/${params.repeat}]` : ''
    status.textContent = `Engine ready${tag}. Warmup (${params.warmupMs} ms)…`
    await delay(params.warmupMs)
    graph.resetGpuTimings()
    status.textContent = `Measuring${tag} (${params.measureMs} ms)…`

    // Wall-clock FPS: count rAF callbacks across the measurement window.
    // Required for the WebGPU path since EXT_disjoint_timer_query is WebGL2-only.
    let rafCount = 0
    let rafActive = true
    const tickRaf = (): void => {
      if (!rafActive) return
      rafCount += 1
      requestAnimationFrame(tickRaf)
    }
    const wallStart = performance.now()
    requestAnimationFrame(tickRaf)
    await delay(params.measureMs)
    rafActive = false
    const wallElapsedMs = performance.now() - wallStart
    const wallFps = wallElapsedMs > 0 ? (rafCount * 1000) / wallElapsedMs : 0

    const snapshot = graph.getGpuTimings() ?? {}
    graph.destroy()
    return { snapshot, wallFps }
  } catch (err) {
    console.error(`[bench] failed at stage='${stage}':`, err)
    if (err instanceof Error) {
      console.error('[bench] full stack:')
      console.error(err.stack ?? '<no stack>')
      if ((err as Error & { cause?: unknown }).cause !== undefined) {
        console.error('[bench] cause:', (err as Error & { cause?: unknown }).cause)
      }
    }
    throw err
  }
  /* eslint-enable no-console */
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
  const wallFpsList: number[] = []
  for (let i = 0; i < params.repeat; i += 1) {
    const { snapshot, wallFps } = await runOnce(data, graphDiv, params, status, i)
    snapshots.push(snapshot)
    wallFpsList.push(wallFps)
  }

  const agg = aggregate(snapshots)
  status.textContent = 'Done.'
  renderResults(agg, resultsDiv, params, data, snapshots, wallFpsList)
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
    wallFps: wallFpsList,
  })
}

run().catch(err => {
  const status = document.getElementById('status')
  if (status) status.textContent = `Error: ${(err as Error).message}`
  // eslint-disable-next-line no-console
  console.error(err)
})
