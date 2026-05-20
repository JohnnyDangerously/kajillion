import type { Graph, GraphConfig } from '@kajillion/graph'

import {
  createCosmicIntroPresentationController,
  type CosmicIntroPresentationController,
} from './cosmic-intro/presentation'
import type { GeneratedGraph } from './generate-graph'
import type { ControlElements, FocusElements } from './features/control-plane/dom'
import type { DemoConfig } from './features/control-plane/types'
import type { DemoRuntimeState } from './features/demo-runtime'
import {
  createLabelOverlayController,
  type LabelOverlayController,
} from './features/ui-state/label-overlay/label-overlay'
import {
  createWorkFocusController,
  type WorkFocusController,
} from './features/work-focus'

interface RuntimeStartupControllersOptions {
  state: DemoRuntimeState;
  ctlEl: ControlElements;
  focusEl: FocusElements;
  buildGraphConfig: (cfg: DemoConfig) => GraphConfig;
  applyTheme: (theme: DemoConfig['theme']) => void;
  applyCurrentVisualAttributes: (graph: Graph, data: GeneratedGraph) => void;
}

export interface RuntimeStartupControllers {
  graphHost: HTMLDivElement;
  labelOverlay: LabelOverlayController;
  cosmicIntroPresentation: CosmicIntroPresentationController;
  workFocusController: WorkFocusController;
}

export function createRuntimeStartupControllers (
  options: RuntimeStartupControllersOptions
): RuntimeStartupControllers {
  const { state, ctlEl, focusEl } = options
  const graphHost = document.getElementById('graph') as HTMLDivElement
  const labelOverlay = createLabelOverlayController({
    graphHost,
    labelContainer: document.getElementById('cluster-labels'),
    initialLabels: [...document.querySelectorAll<HTMLDivElement>('#cluster-labels .cluster-label')],
    workRegionsEl: document.getElementById('work-regions') as HTMLDivElement | null,
    getConfig: () => state.currentConfig,
    getGraph: () => state.currentGraph ?? (window as unknown as { __demoGraph?: Graph }).__demoGraph ?? null,
  })
  const cosmicIntroPresentation = createCosmicIntroPresentationController({
    ctlEl,
    getCurrentConfig: () => state.currentConfig,
    setCurrentConfig: (cfg) => { state.currentConfig = cfg },
    getCurrentGraph: () => state.currentGraph,
    applyTheme: options.applyTheme,
    handleError: (err) => console.error(err),
  })
  const workFocusController = createWorkFocusController({
    focusEl,
    getCurrentConfig: () => state.currentConfig,
    getCurrentGraph: () => state.currentGraph,
    getCurrentData: () => state.currentData,
    getCurrentRenderData: () => state.currentRenderData,
    buildGraphConfig: options.buildGraphConfig,
    applyCurrentVisualAttributes: options.applyCurrentVisualAttributes,
  })

  return {
    graphHost,
    labelOverlay,
    cosmicIntroPresentation,
    workFocusController,
  }
}
