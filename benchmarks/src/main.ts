import { Graph, type GraphConfig, type GpuTimingSnapshot } from '@kajillion/graph'
import { generateBA, type GeneratedGraph } from './generate-graph'

interface BenchParams {
  nodeCount: number;
  edgesPerNode: number;
  seed: number;
  warmupMs: number;
  measureMs: number;
}

function readParams (): BenchParams {
  const u = new URL(window.location.href)
  return {
    nodeCount: Number(u.searchParams.get('n') ?? '100000'),
    edgesPerNode: Number(u.searchParams.get('m') ?? '3'),
    seed: Number(u.searchParams.get('seed') ?? '42'),
    warmupMs: Number(u.searchParams.get('warmup') ?? '2000'),
    measureMs: Number(u.searchParams.get('measure') ?? '8000'),
  }
}

function formatMs (ms: number): string {
  if (ms < 0.01) return '< 0.01 ms'
  return `${ms.toFixed(3)} ms`
}

function renderResults (snapshot: GpuTimingSnapshot, container: HTMLElement, params: BenchParams, data: GeneratedGraph): void {
  const entries = Object.entries(snapshot).sort((a, b) => b[1].avgMs - a[1].avgMs)
  const totalAvg = entries.reduce((s, [, t]) => s + t.avgMs, 0)
  const rows = entries.map(([label, t]) => `
    <tr>
      <td>${label}</td>
      <td style="text-align:right">${formatMs(t.avgMs)}</td>
      <td style="text-align:right">${formatMs(t.lastMs)}</td>
      <td style="text-align:right">${t.sampleCount}</td>
    </tr>
  `).join('')
  const nodes = data.nodeCount.toLocaleString()
  const edges = data.edgeCount.toLocaleString()
  const datasetLine = `${nodes} nodes &middot; ${edges} edges (Barabási–Albert, m=${params.edgesPerNode}, seed=${params.seed})`
  const rawJson = JSON.stringify({
    params,
    dataset: { nodeCount: data.nodeCount, edgeCount: data.edgeCount },
    snapshot,
  }, null, 2)
  const fallbackRow = '<tr><td colspan="4"><em>No samples — extension unsupported on this browser?</em></td></tr>'

  container.innerHTML = `
    <h2>Baseline result</h2>
    <p><strong>Dataset:</strong> ${datasetLine}</p>
    <p><strong>Window:</strong> ${params.measureMs} ms measurement after ${params.warmupMs} ms warmup</p>
    <p><strong>Total instrumented GPU time per frame (avg):</strong> ${formatMs(totalAvg)}</p>
    <table>
      <thead>
        <tr><th>Pass</th><th>Avg GPU (ms)</th><th>Last (ms)</th><th>Samples</th></tr>
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
  const graph = new Graph(graphDiv, config)
  await graph.ready
  graph.setPointPositions(data.positions)
  graph.setLinks(data.links)
  graph.render()

  status.textContent = `Engine ready. Warmup (${params.warmupMs} ms)…`
  await delay(params.warmupMs)
  status.textContent = `Measuring (${params.measureMs} ms)…`
  await delay(params.measureMs)

  const snapshot = graph.getGpuTimings() ?? {}
  status.textContent = 'Done.'
  renderResults(snapshot, resultsDiv, params, data)
  console.log('[kajillion-bench] snapshot', snapshot)
}

run().catch(err => {
  const status = document.getElementById('status')
  if (status) status.textContent = `Error: ${(err as Error).message}`
  // eslint-disable-next-line no-console
  console.error(err)
})
