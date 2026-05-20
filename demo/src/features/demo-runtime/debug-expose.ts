import type { Graph } from '@kajillion/graph'
import type { GraphFrame, GraphSnapshot, ViewSpec } from '../../graph-contract'
import { createVisualLabControlPlane, type VisualLabControlPlane } from '../../visual-lab-control-plane'
import type { DemoRuntimeContext } from './context'

interface DemoDebugWindow {
  __demoGraph: Graph;
  __demoSnapshot?: GraphSnapshot | null;
  __demoFrame?: GraphFrame | null;
  __demoViewSpec?: ViewSpec | null;
  __kajillionWorkMode?: {
    getZoomStage: DemoRuntimeContext['workFocusController']['getZoomStage'];
    goToZoomStage: DemoRuntimeContext['workFocusController']['goToZoomStage'];
    goToGalaxyOverview: DemoRuntimeContext['workFocusController']['goToGalaxyOverview'];
    goToClusterDiscovery: DemoRuntimeContext['workFocusController']['goToClusterDiscovery'];
    goToSingleCluster: DemoRuntimeContext['workFocusController']['goToSingleCluster'];
    goToWorkMode: DemoRuntimeContext['workFocusController']['goToWorkMode'];
  };
  __kajillionLab?: VisualLabControlPlane | null;
  __dumpKajillionTrace: () => unknown;
  __markKajillionFlash: (label?: string) => void;
  __clearKajillionTrace: () => void;
  __runKajillionReplay: () => Promise<unknown>;
}

export function exposeDemoDebugGraph (runtime: DemoRuntimeContext, graph: Graph): void {
  const { state } = runtime
  const debugWindow = window as unknown as DemoDebugWindow
  debugWindow.__demoGraph = graph
  debugWindow.__demoSnapshot = state.currentSnapshot
  debugWindow.__demoFrame = state.currentFrame
  debugWindow.__demoViewSpec = state.currentViewSpec
  debugWindow.__kajillionWorkMode = {
    getZoomStage: runtime.workFocusController.getZoomStage,
    goToZoomStage: runtime.workFocusController.goToZoomStage,
    goToGalaxyOverview: runtime.workFocusController.goToGalaxyOverview,
    goToClusterDiscovery: runtime.workFocusController.goToClusterDiscovery,
    goToSingleCluster: runtime.workFocusController.goToSingleCluster,
    goToWorkMode: runtime.workFocusController.goToWorkMode,
  }
  state.visualLabControlPlane ||= createVisualLabControlPlane({
    getSnapshot: () => state.currentSnapshot,
    getFrame: () => state.currentFrame,
    getViewSpec: () => state.currentViewSpec,
    getInteractionState: () => state.labInteractionState,
    setSnapshot: (snapshot, frame) => {
      state.currentSnapshot = snapshot
      state.currentFrame = frame
      debugWindow.__demoSnapshot = state.currentSnapshot
      debugWindow.__demoFrame = state.currentFrame
      runtime.applyFrameToCurrentGraph()
    },
    setViewSpec: (viewSpec) => {
      state.currentViewSpec = viewSpec
      debugWindow.__demoViewSpec = state.currentViewSpec
      runtime.applyFrameToCurrentGraph()
    },
    focusNode: runtime.visualLabActions.focusNode,
    applyNodeExpansion: runtime.visualLabActions.applyNodeExpansion,
    setNodeFilter: runtime.visualLabActions.setNodeFilter,
    clearInteraction: runtime.visualLabActions.clearInteraction,
  })
  debugWindow.__kajillionLab = state.visualLabControlPlane
  debugWindow.__dumpKajillionTrace = () => graph.getDebugFrameTrace()
  debugWindow.__markKajillionFlash = (label = 'manual') => graph.markDebugFlash(label)
  debugWindow.__clearKajillionTrace = () => graph.clearDebugFrameTrace()
  debugWindow.__runKajillionReplay = () => runtime.runReplayCapture()
}
