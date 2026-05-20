import { createRuntimeActions, type RuntimeActions } from '../runtime-actions'
import type { DemoRuntimeContext } from './context'

export function createDemoRuntimeActions (runtime: DemoRuntimeContext): RuntimeActions {
  const { state } = runtime
  return createRuntimeActions({
    graphHost: runtime.graphHost,
    getCurrentConfig: () => state.currentConfig,
    setCurrentConfig: (cfg) => { state.currentConfig = cfg },
    getCurrentGraph: () => state.currentGraph,
    setCurrentGraph: (graph) => { state.currentGraph = graph },
    setCurrentData: (data) => { state.currentData = data },
    getCurrentRenderData: () => state.currentRenderData,
    setCurrentRenderData: (data) => { state.currentRenderData = data },
    setCurrentDataKey: (key) => { state.currentDataKey = key },
    setCurrentSnapshot: (snapshot) => { state.currentSnapshot = snapshot },
    setCurrentFrame: (frame) => { state.currentFrame = frame },
    setCurrentViewSpec: (viewSpec) => { state.currentViewSpec = viewSpec },
    resetLabInteractionState: (edgeMode) => {
      state.labNodeFilterMask = null
      state.labNodeFilterEdgeMode = edgeMode
      state.labInteractionState = null
    },
    resetAgentPresentationState: () => {
      runtime.labelOverlay.clearAnchors()
      runtime.workFocusController.reset()
    },
    setMetaNodeCount: (text) => { runtime.overlayEl.metaN.textContent = text },
    buildGraphConfig: runtime.buildGraphConfig,
    buildVisualAttributes: runtime.buildVisualAttributes,
    exposeDebugGraph: runtime.exposeDebugGraph,
    getVisualLabControlPlane: () => state.visualLabControlPlane,
  })
}
