import { type Graph, type GraphConfig } from '@kajillion/graph'

import type { FocusElements } from '../control-plane/dom'
import type { DemoConfig } from '../control-plane/types'
import type { GeneratedGraph } from '../../generate-graph'
import type { WorkFocusState } from '../ui-state/work-focus-panel'

export interface WorkFocusControllerOptions {
  focusEl: FocusElements;
  getCurrentConfig: () => DemoConfig;
  getCurrentGraph: () => Graph | null;
  getCurrentData: () => GeneratedGraph | null;
  getCurrentRenderData: () => GeneratedGraph | null;
  buildGraphConfig: (cfg: DemoConfig) => GraphConfig;
  applyCurrentVisualAttributes: (graph: Graph, data: GeneratedGraph) => void;
}

export interface WorkFocusController {
  getFocusState: () => WorkFocusState | undefined;
  reset: () => void;
  updatePanel: () => void;
  clearPreview: () => void;
  previewPoint: (index: number) => void;
  previewLink: (index: number) => void;
  clearFocus: (fitOverview: boolean) => void;
  focusPoint: (index: number, shouldZoom: boolean) => void;
  focusLink: (index: number, shouldZoom: boolean) => void;
  fitNeighborhood: () => void;
  stepIntoPoint: () => void;
}

export function baseOutlinedPointIndices (): number[] | undefined {
  return undefined
}
