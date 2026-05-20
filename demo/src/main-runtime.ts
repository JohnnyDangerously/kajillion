import { Graph } from '@kajillion/graph'
import { isWorkMode } from './features/control-plane/controls'
import type { ControlElements, FocusElements, OverlayElements } from './features/control-plane/dom'
import type { DemoConfig } from './features/control-plane/types'
import type { GeneratedGraph } from './generate-graph'
import { type RenderableGraphData } from './graph-contract'
import { WallFps } from './features/control-plane/perf-overlay'
import { installDemoControls } from './features/ui-state/demo-controls'
import type { BakeLoadBusyState } from './features/bake-layout/bake-load'
import { buildDemoGraphConfig } from './features/graph-config/build-graph-config'
import {
  applyDemoControlChange,
  bootDemo,
  createDemoRuntimeActions,
  exposeDemoDebugGraph,
  installDemoBenchmarkControls,
  rebuildDemoGraph,
  type DemoRuntimeContext,
  type DemoRuntimeState,
} from './features/demo-runtime'
import { createVisualLabActions } from './features/demo-runtime/visual-lab-actions'
import { createRuntimeStartupControllers } from './main-runtime-controllers'
import { createRuntimeVisualControllers } from './main-runtime-visuals'

interface DemoRuntimeStartupOptions {
  state: DemoRuntimeState;
  overlayEl: OverlayElements;
  ctlEl: ControlElements;
  focusEl: FocusElements;
}

export function startDemoRuntime ({
  state: demoState,
  overlayEl,
  ctlEl,
  focusEl,
}: DemoRuntimeStartupOptions): void {
  const bakeLoadBusyState: BakeLoadBusyState = { bake: false, load: false, replay: false }

  const {
    graphHost,
    labelOverlay,
    cosmicIntroPresentation,
    workFocusController,
  } = createRuntimeStartupControllers({
    state: demoState,
    ctlEl,
    focusEl,
    buildGraphConfig,
    applyTheme,
    applyCurrentVisualAttributes,
  })

  function syncDependentControls (): void {
    demoControls.syncDependentControls()
  }

  function syncToggleButtons (): void {
    demoControls.syncToggleButtons()
  }

  function buildGraphConfig (cfg: DemoConfig) {
    return buildDemoGraphConfig(cfg, {
      previewWorkPoint: workFocusController.previewPoint,
      clearWorkPreview: workFocusController.clearPreview,
      previewWorkLink: workFocusController.previewLink,
      focusWorkPoint: workFocusController.focusPoint,
      exploreNodeClickHook: demoState.exploreNodeClickHook,
      focusWorkLink: workFocusController.focusLink,
      clearWorkFocus: workFocusController.clearFocus,
      scheduleAnalystZoomVisualRefresh,
    })
  }

  function applyTheme (theme: DemoConfig['theme']): void {
    document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark'
    document.documentElement.dataset.graphMode = isWorkMode(demoState.currentConfig) ? 'work' : 'galaxy'
    document.documentElement.dataset.palette = demoState.currentConfig.palette
    document.documentElement.dataset.tilt = demoState.currentConfig.tilt ? 'on' : 'off'
    ctlEl.theme.classList.toggle('active', theme === 'dark')
    cosmicIntroPresentation.syncPresentation(theme)
    syncToggleButtons()
  }

  function applyCurrentVisualAttributes (
    graph: Graph,
    data: GeneratedGraph | RenderableGraphData
  ): void {
    visualRuntime.applyCurrentVisualAttributes(graph, data)
  }

  function scheduleAnalystZoomVisualRefresh (immediate = false): void {
    visualRuntime.scheduleAnalystZoomVisualRefresh(immediate)
  }

  const visualRuntime = createRuntimeVisualControllers({
    state: demoState,
    ctlEl,
    labelOverlay,
    workFocusController,
    buildGraphConfig,
    applyTheme,
    syncToggleButtons,
    applyControlChange,
  })
  const demoControls = installDemoControls(ctlEl, focusEl, {
    getCurrentConfig: () => demoState.currentConfig,
    setCurrentConfig: (cfg) => { demoState.currentConfig = cfg },
    applyControlChange,
    applyVisualControls: visualRuntime.visualControls.applyVisualControls,
    scheduleVisualControls: visualRuntime.visualControls.scheduleVisualControls,
    clearWorkFocus: workFocusController.clearFocus,
    fitWorkNeighborhood: workFocusController.fitNeighborhood,
    stepIntoWorkPoint: workFocusController.stepIntoPoint,
    rebuildGraph,
    resetCosmicIntroDismissal: cosmicIntroPresentation.resetDismissal,
    handleError: (err) => console.error(err),
  })
  syncDependentControls()
  applyTheme(demoState.currentConfig.theme)
  const wallFps = new WallFps()
  let runtimeContext: DemoRuntimeContext

  function exposeDebugGraph (graph: Graph): void {
    exposeDemoDebugGraph(runtimeContext, graph)
  }

  async function rebuildGraph (cfg: DemoConfig): Promise<void> {
    demoState.currentConfig = cfg
    await rebuildDemoGraph(runtimeContext)
  }

  async function applyControlChange (): Promise<void> {
    await applyDemoControlChange(runtimeContext)
  }

  function runReplayCapture (): Promise<unknown> {
    return demoState.replayCaptureRunner?.() ?? Promise.resolve(null)
  }

  const visualLabActions = createVisualLabActions({
    state: demoState,
    buildGraphConfig,
    applyFrameToCurrentGraph: visualRuntime.applyFrameToCurrentGraph,
  })

  runtimeContext = {
    state: demoState,
    overlayEl,
    ctlEl,
    focusEl,
    graphHost,
    labelOverlay,
    cosmicIntroPresentation,
    workFocusController,
    frameVisualsController: visualRuntime.frameVisualsController,
    analystZoomVisualRefreshScheduler: visualRuntime.analystZoomVisualRefreshScheduler,
    demoControls,
    wallFps,
    bakeLoadBusyState,
    visualLabActions,
    buildGraphConfig,
    applyTheme,
    applyCurrentVisualAttributes: visualRuntime.applyCurrentVisualAttributes,
    buildVisualAttributes: visualRuntime.buildVisualAttributes,
    applyFrameToCurrentGraph: visualRuntime.applyFrameToCurrentGraph,
    scheduleAnalystZoomVisualRefresh: visualRuntime.scheduleAnalystZoomVisualRefresh,
    rebuildGraph,
    exposeDebugGraph,
    runReplayCapture,
  }

  installDemoBenchmarkControls(runtimeContext)
  const runtimeActions = createDemoRuntimeActions(runtimeContext)
  bootDemo(runtimeContext, runtimeActions).catch(err => console.error(err))
}
