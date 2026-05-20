import type { Graph, GraphConfig } from '@kajillion/graph'
import type { ControlElements } from './features/control-plane/dom'
import type { DemoConfig } from './features/control-plane/types'
import type { DemoRuntimeState } from './features/demo-runtime'
import {
  createFrameVisualsController,
  type FrameVisualsController,
  type VisualAttributeApplyOptions,
} from './features/ui-state/frame-visuals'
import type { LabelOverlayController } from './features/ui-state/label-overlay/label-overlay'
import {
  createAnalystZoomVisualRefreshScheduler,
  createVisualControlsController,
  type AnalystZoomVisualRefreshScheduler,
  type VisualControlsController,
} from './features/ui-state/visual-controls'
import type { VisualAttributes } from './features/ui-state/visual-attributes'
import type { WorkModeController } from './features/work-mode'
import type { GeneratedGraph } from './generate-graph'
import type { RenderableGraphData } from './graph-contract'

interface RuntimeVisualControllersOptions {
  state: DemoRuntimeState;
  ctlEl: ControlElements;
  labelOverlay: LabelOverlayController;
  workFocusController: WorkModeController;
  buildGraphConfig: (cfg: DemoConfig) => GraphConfig;
  applyTheme: (theme: DemoConfig['theme']) => void;
  syncToggleButtons: () => void;
  applyControlChange: () => Promise<void>;
}

export interface RuntimeVisualControllers {
  frameVisualsController: FrameVisualsController;
  analystZoomVisualRefreshScheduler: AnalystZoomVisualRefreshScheduler;
  visualControls: VisualControlsController;
  applyCurrentVisualAttributes: (
    graph: Graph,
    data: GeneratedGraph | RenderableGraphData,
    options?: VisualAttributeApplyOptions
  ) => void;
  buildVisualAttributes: (data: GeneratedGraph | RenderableGraphData) => VisualAttributes;
  applyFrameToCurrentGraph: () => void;
  scheduleAnalystZoomVisualRefresh: (immediate?: boolean) => void;
}

export function createRuntimeVisualControllers (
  options: RuntimeVisualControllersOptions
): RuntimeVisualControllers {
  const { state, ctlEl, labelOverlay, workFocusController } = options

  function currentEqualizationZoomDistance (): number {
    return state.currentGraph?.getZoomDistance?.() ?? 1
  }

  function currentOverviewZoomDistance (): number {
    return state.currentGraph?.getZoomDistance?.() ?? 100
  }

  function applyCurrentVisualAttributes (
    graph: Graph,
    data: GeneratedGraph | RenderableGraphData,
    applyOptions: VisualAttributeApplyOptions = {}
  ): void {
    frameVisualsController.applyCurrentVisualAttributes(graph, data, applyOptions)
  }

  function buildVisualAttributes (data: GeneratedGraph | RenderableGraphData): VisualAttributes {
    return frameVisualsController.buildVisualAttributes(data)
  }

  function applyFrameToCurrentGraph (): void {
    frameVisualsController.applyFrameToCurrentGraph()
  }

  function scheduleAnalystZoomVisualRefresh (immediate = false): void {
    analystZoomVisualRefreshScheduler.schedule(immediate)
  }

  const frameVisualsController = createFrameVisualsController({
    getCurrentConfig: () => state.currentConfig,
    getCurrentGraph: () => state.currentGraph,
    getCurrentData: () => state.currentData,
    getCurrentRenderData: () => state.currentRenderData,
    setCurrentRenderData: (data) => { state.currentRenderData = data },
    getCurrentFrame: () => state.currentFrame,
    getCurrentViewSpec: () => state.currentViewSpec,
    getLabNodeFilterMask: () => state.labNodeFilterMask,
    getLabNodeFilterEdgeMode: () => state.labNodeFilterEdgeMode,
    getWorkFocusState: workFocusController.getFocusState,
    setLabelAnchors: (anchors) => { labelOverlay.setAnchors(anchors) },
    equalizationZoomDistance: currentEqualizationZoomDistance,
    overviewZoomDistance: currentOverviewZoomDistance,
  })
  const analystZoomVisualRefreshScheduler = createAnalystZoomVisualRefreshScheduler({
    getCurrentConfig: () => state.currentConfig,
    getCurrentGraph: () => state.currentGraph,
    getCurrentRenderData: () => state.currentRenderData,
    applyCurrentVisualAttributes,
  })
  const visualControls = createVisualControlsController({
    ctlEl,
    getCurrentConfig: () => state.currentConfig,
    setCurrentConfig: (cfg) => { state.currentConfig = cfg },
    getCurrentGraph: () => state.currentGraph,
    getCurrentData: () => state.currentData,
    buildGraphConfig: options.buildGraphConfig,
    applyCurrentVisualAttributes,
    applyTheme: options.applyTheme,
    syncToggleButtons: options.syncToggleButtons,
    applyControlChange: options.applyControlChange,
    updateWorkFocusPanel: workFocusController.updatePanel,
  })

  return {
    frameVisualsController,
    analystZoomVisualRefreshScheduler,
    visualControls,
    applyCurrentVisualAttributes,
    buildVisualAttributes,
    applyFrameToCurrentGraph,
    scheduleAnalystZoomVisualRefresh,
  }
}
