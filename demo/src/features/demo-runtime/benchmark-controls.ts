import {
  installBakeLoadControls,
  updateBakeLoadButtons as updateBakeLoadControlButtons,
} from '../bake-layout/bake-load'
import { DEMO_SPACE_SIZE } from '../demo-lifecycle/demo-space'
import { installBaselineRecorder } from '../replay-bench/baseline-recorder'
import { installReplayCapture } from '../replay-bench/replay-capture'
import type { DemoRuntimeContext } from './context'

export function updateDemoBakeLoadButtons (runtime: DemoRuntimeContext): void {
  updateBakeLoadControlButtons(runtime.ctlEl, runtime.bakeLoadBusyState)
}

export function installDemoBenchmarkControls (runtime: DemoRuntimeContext): void {
  const { state } = runtime
  installBaselineRecorder(runtime.ctlEl, {
    graphHost: runtime.graphHost,
    spaceSize: DEMO_SPACE_SIZE,
    getCurrentConfig: () => state.currentConfig,
    getCurrentData: () => state.currentData,
    getCurrentGraph: () => state.currentGraph,
    setCurrentGraph: (graph) => { state.currentGraph = graph },
    buildGraphConfig: runtime.buildGraphConfig,
    buildVisualAttributes: runtime.buildVisualAttributes,
    rebuildGraph: runtime.rebuildGraph,
  })

  state.replayCaptureRunner = installReplayCapture(runtime.ctlEl, {
    graphHost: runtime.graphHost,
    getCurrentGraph: () => state.currentGraph,
    getCurrentData: () => state.currentData,
    getCurrentConfig: () => state.currentConfig,
    getWallFpsLatest: () => runtime.wallFps.latest,
    getRenderFps: () => state.renderFps,
    setReplayBusy: (busy) => { runtime.bakeLoadBusyState.replay = busy },
    updateBusyButtons: () => updateDemoBakeLoadButtons(runtime),
  }, DEMO_SPACE_SIZE)

  installBakeLoadControls(runtime.ctlEl, {
    graphHost: runtime.graphHost,
    spaceSize: DEMO_SPACE_SIZE,
    getCurrentConfig: () => state.currentConfig,
    getCurrentData: () => state.currentData,
    getCurrentGraph: () => state.currentGraph,
    setCurrentGraph: (graph) => { state.currentGraph = graph },
    setCurrentData: (data) => { state.currentData = data },
    setCurrentRenderData: (data) => { state.currentRenderData = data },
    buildGraphConfig: runtime.buildGraphConfig,
    buildVisualAttributes: runtime.buildVisualAttributes,
    setMetaNodeCount: (text) => { runtime.overlayEl.metaN.textContent = text },
    exposeDebugGraph: runtime.exposeDebugGraph,
    setBusy: (kind, busy) => { runtime.bakeLoadBusyState[kind] = busy },
    updateBusyButtons: () => updateDemoBakeLoadButtons(runtime),
  })
}
