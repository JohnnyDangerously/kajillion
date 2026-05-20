import { Graph, type GraphConfig, type GpuTimingSnapshot } from '@kajillion/graph'
import { captureDiagnostics, formatPowerInfo, getPowerInfo, type BenchDiagnostics } from './diagnostics'
import { aggregate, postResults, renderResults } from './formatting'
import { generateCosmoLab } from './generate-cosmo'
import { generateBA, type GeneratedGraph } from './generate-graph'
import { makeActivePointIndices, readParams, type BenchParams } from './params'

function delay (ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function runOnce (
  data: GeneratedGraph,
  graphDiv: HTMLDivElement,
  params: BenchParams,
  status: HTMLElement,
  runIdx: number
): Promise<{ snapshot: GpuTimingSnapshot; wallFps: number; diagnostics: BenchDiagnostics }> {
  const config: GraphConfig = {
    spaceSize: 4096,
    backgroundColor: '#0f1115',
    pointDefaultColor: '#7fb3ff',
    pointDefaultSize: params.pointDefaultSize ?? 2,
    linkDefaultColor: '#2c3e63',
    linkDefaultWidth: params.linkDefaultWidth ?? 0.5,
    linkOpacity: 0.5,
    renderLinks: params.renderLinks,
    disableIdleFrameSkip: params.continuousRender,
    curvedLinks: false,
    fitViewOnInit: true,
    enableSimulation: !params.nosim,
    simulationFriction: 0.85,
    simulationRepulsion: 0.5,
    simulationGravity: 0.1,
    enableGpuTimings: true,
    activePointIndices: makeActivePointIndices(data.nodeCount, params.activePointFraction),
  }
  if (params.pixelRatio !== undefined) config.pixelRatio = params.pixelRatio
  if (params.zoomLevel !== undefined) {
    config.fitViewOnInit = false
    config.initialZoomLevel = params.zoomLevel
  }
  config.linkBlendMode = params.linkBlendMode
  if (params.adaptiveDpr !== undefined) config.adaptivePixelRatio = params.adaptiveDpr
  if (params.linkOpacity !== undefined) config.linkOpacity = params.linkOpacity
  if (params.pointMinPixelSize !== undefined) config.pointMinPixelSize = params.pointMinPixelSize
  if (params.pointLodStrength !== undefined) config.pointLodStrength = params.pointLodStrength
  if (params.impostorMassRadiusScale !== undefined) config.impostorMassRadiusScale = params.impostorMassRadiusScale
  if (params.impostorMassThreshold !== undefined) config.impostorMassThreshold = params.impostorMassThreshold
  if (params.impostorMassMaxAlpha !== undefined) config.impostorMassMaxAlpha = params.impostorMassMaxAlpha
  if (params.impostorMassColorBoost !== undefined) config.impostorMassColorBoost = params.impostorMassColorBoost
  if (params.impostorMassExtrusion !== undefined) config.impostorMassExtrusion = params.impostorMassExtrusion
  if (params.linkMinPixelLength !== undefined) config.linkMinPixelLength = params.linkMinPixelLength
  if (params.renderLodMode !== undefined) config.renderLodMode = params.renderLodMode
  if (params.useWebGPU) config.useWebGPU = true
  if (params.msaa === 4) config.msaa = 4
  if (params.linkWidthScale !== undefined) config.linkWidthScale = params.linkWidthScale
  if (params.frameRateLimit !== undefined) config.frameRateLimit = params.frameRateLimit
  if (params.frameRateHeadroomFps !== undefined) config.frameRateHeadroomFps = params.frameRateHeadroomFps

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
    const diagnostics = captureDiagnostics(graph, graphDiv)
    graph.destroy()
    return { snapshot, wallFps, diagnostics }
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

  // Capture power state BEFORE anything else. Logged loudly so a quick
  // console scan reveals throttle conditions without scrolling — the most
  // common bench mistake is comparing throttled to non-throttled numbers.
  const power = await getPowerInfo()
  // eslint-disable-next-line no-console
  console.log(`[bench] power: ${formatPowerInfo(power)}`)
  if (power.throttleSuspected) {
    // eslint-disable-next-line no-console
    console.warn('[bench] ⚠︎ Throttle suspected — comparisons to AC-power baselines are invalid.')
  }

  // Data generator: BA (default) or cosmo-lab's community-structured topology
  // for apples-to-apples comparison with the cosmo-lab bench.
  const t0 = performance.now()
  let data: GeneratedGraph
  if (params.dataMode === 'cosmo') {
    status.textContent = `Generating cosmo-lab community graph (n=${params.nodeCount}, seed=${params.seed})…`
    data = generateCosmoLab({ count: params.nodeCount, seed: params.seed })
  } else {
    status.textContent = `Generating BA graph (n=${params.nodeCount}, m=${params.edgesPerNode}, seed=${params.seed})…`
    data = generateBA(params.nodeCount, params.edgesPerNode, params.seed)
  }
  const tGen = performance.now() - t0
  const nodes = data.nodeCount.toLocaleString()
  const edges = data.edgeCount.toLocaleString()
  status.textContent = `Generated ${nodes} nodes / ${edges} edges in ${tGen.toFixed(0)} ms. Initializing engine…`

  const snapshots: GpuTimingSnapshot[] = []
  const wallFpsList: number[] = []
  const diagnosticsList: BenchDiagnostics[] = []
  for (let i = 0; i < params.repeat; i += 1) {
    const { snapshot, wallFps, diagnostics } = await runOnce(data, graphDiv, params, status, i)
    snapshots.push(snapshot)
    wallFpsList.push(wallFps)
    diagnosticsList.push(diagnostics)
  }

  const agg = aggregate(snapshots)
  status.textContent = 'Done.'
  renderResults(agg, resultsDiv, params, data, snapshots, wallFpsList, diagnosticsList, power)
  console.log('[kajillion-bench] aggregate', agg)
  await postResults({
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    devicePixelRatio: window.devicePixelRatio,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    power,
    params,
    dataset: { nodeCount: data.nodeCount, edgeCount: data.edgeCount, generator: params.dataMode },
    diagnostics: diagnosticsList,
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
