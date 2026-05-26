import { Graph } from '@kajillion/graph'
import { generateCosmoLab } from '../../../../benchmarks/src/generate-cosmo'
import { generateBA } from '../../generate-graph'
import {
  buildDefaultViewSpec,
  generatedGraphToSnapshot,
  graphFrameFromSnapshot,
} from '../../graph-contract'
import { DEMO_SPACE_SIZE } from '../demo-lifecycle/demo-space'
import { renderDataFromFrame } from '../demo-lifecycle/render-data'
import { scaleGeneratedDataToDemoSpace } from '../demo-lifecycle/work-graph-generator'
import { resolveRepresentationFromUrl } from '../representations'
import { buildLabelAnchors } from '../ui-state/label-overlay/label-anchors'
import {
  buildWorkModeRenderData,
  generateWorkModeSourceData,
  isExplicitWorkDataset,
  isWorkMode,
  WORK_MODE_CAMERA,
} from '../work-mode'
import type { DemoRuntimeContext } from './context'

let currentRepresentationTeardown: (() => void) | null = null

export async function rebuildDemoGraph (runtime: DemoRuntimeContext): Promise<void> {
  const { state } = runtime
  const cfg = state.currentConfig
  runtime.applyTheme(cfg.theme)
  runtime.overlayEl.metaN.textContent = cfg.n.toLocaleString()
  state.lastRenderSampleCount = 0
  state.lastRenderSampleTs = performance.now()
  state.renderFps = undefined
  runtime.analystZoomVisualRefreshScheduler.reset()
  if (currentRepresentationTeardown) {
    try { currentRepresentationTeardown() } catch { /* ignore */ }
    currentRepresentationTeardown = null
  }
  if (state.currentGraph) {
    try { state.currentGraph.destroy() } catch { /* ignore */ }
    state.currentGraph = null
  }
  runtime.graphHost.innerHTML = ''

  const dataKey = `${cfg.dataMode}:${cfg.n}:${cfg.seed}`
  const needsRegen = !state.currentData || state.currentDataKey !== dataKey
  if (needsRegen) {
    const generated = isExplicitWorkDataset(cfg)
      ? generateWorkModeSourceData(cfg)
      : cfg.dataMode === 'cosmo'
        ? generateCosmoLab({ count: cfg.n, seed: cfg.seed, layoutStyle: 'organic' })
        : generateBA(cfg.n, 3, cfg.seed)
    state.currentData = isExplicitWorkDataset(cfg) ? generated : scaleGeneratedDataToDemoSpace(generated)
    state.currentDataKey = dataKey
  }
  const data = state.currentData!
  const snapshot = generatedGraphToSnapshot(data, {
    datasetId: cfg.dataMode,
    graphId: `${cfg.dataMode}-${cfg.n}`,
    title: `${cfg.dataMode} ${cfg.n.toLocaleString()}`,
    generator: cfg.dataMode,
    seed: cfg.seed,
    sourceSpaceSize: DEMO_SPACE_SIZE,
  })
  const viewSpec = buildDefaultViewSpec({
    palette: cfg.palette,
    theme: cfg.theme,
    density: cfg.density,
    lanes: cfg.lanes,
    renderLinks: cfg.renderLinks,
  })
  if (isExplicitWorkDataset(cfg) && cfg.renderLinks) {
    viewSpec.edge.visibleKinds = ['observed', 'second_degree', 'predicted']
  }
  const frame = graphFrameFromSnapshot(snapshot, viewSpec.layout)
  state.labNodeFilterMask = null
  state.labNodeFilterEdgeMode = 'inside'
  state.labInteractionState = null
  const renderData = isExplicitWorkDataset(cfg)
    ? buildWorkModeRenderData(frame, viewSpec, cfg, state.currentData)
    : renderDataFromFrame(frame, viewSpec, cfg, DEMO_SPACE_SIZE)
  const representation = resolveRepresentationFromUrl()
  if (representation?.transformPositions) {
    const replacement = representation.transformPositions(renderData, cfg)
    if (replacement) renderData.positions = replacement
  }
  state.currentSnapshot = snapshot
  state.currentFrame = frame
  state.currentViewSpec = viewSpec
  state.currentRenderData = renderData
  runtime.labelOverlay.setAnchors(buildLabelAnchors(renderData, state.currentConfig))
  runtime.workFocusController.reset()
  runtime.workFocusController.updatePanel()

  const graph = new Graph(runtime.graphHost, runtime.buildGraphConfig(cfg))
  if (representation?.install && representation.ownsCamera) {
    const teardown = representation.install({ graph, host: runtime.graphHost, data: renderData, config: cfg })
    if (typeof teardown === 'function') currentRepresentationTeardown = teardown
  }
  await graph.ready
  graph.setPointPositions(renderData.positions, isWorkMode(cfg) || renderData !== data)
  graph.setLinks(renderData.links)
  runtime.applyCurrentVisualAttributes(graph, renderData)
  state.currentGraph = graph
  runtime.exposeDebugGraph(graph)
  runtime.workFocusController.updatePanel()
  graph.render()
  if (representation?.install && !representation.ownsCamera) {
    const teardown = representation.install({
      graph,
      host: runtime.graphHost,
      data: renderData,
      config: cfg,
    })
    if (typeof teardown === 'function') currentRepresentationTeardown = teardown
  }
  if (isWorkMode(cfg) && !representation?.ownsCamera) {
    requestAnimationFrame(() => {
      if (state.currentGraph !== graph) return
      graph.setZoomTransformByPointPositions(
        renderData.positions,
        WORK_MODE_CAMERA.initialFitDurationMs,
        undefined,
        WORK_MODE_CAMERA.initialFitPadding,
        false
      )
    })
  }
}
