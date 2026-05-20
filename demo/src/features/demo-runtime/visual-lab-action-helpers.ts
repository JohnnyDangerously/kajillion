import type { Graph, GraphConfig } from '@kajillion/graph'
import type { DemoConfig } from '../control-plane/types'
import {
  linkIndicesForPointSet,
  type GraphEdgeMode,
} from '../ui-state/graph-interactions'
import type { NodeFocusOptions } from '../../visual-lab-control-plane'
import type { DemoRuntimeState } from './context'

interface VisualLabConfigOptions {
  currentConfig: DemoConfig;
  buildGraphConfig: (cfg: DemoConfig) => GraphConfig;
}

interface SelectionConfigOptions extends VisualLabConfigOptions {
  focusedPointIndex?: number;
  pointIndices: number[];
  linkIndices: number[];
  materialize: boolean;
  restoreEmptyPointGreyout?: boolean;
  requireNonEmptyActiveLinks?: boolean;
}

export function validPointIndices (pointIndices: number[], nodeCount: number): number[] {
  return [...new Set(pointIndices)]
    .filter(index => Number.isInteger(index) && index >= 0 && index < nodeCount)
}

export function focusFilterState (filter: NodeFocusOptions['filter']): {
  shouldFilter: boolean;
  materialize: boolean;
} {
  return {
    shouldFilter: filter === true || filter === 'visual' || filter === 'materialized',
    materialize: filter === 'materialized',
  }
}

export function clampFocusOptions (actionOptions: NodeFocusOptions): {
  hops: number;
  maxNodes: number;
} {
  return {
    hops: Math.max(0, Math.min(4, Math.trunc(actionOptions.hops ?? 1))),
    maxNodes: Math.max(1, Math.min(50_000, Math.trunc(actionOptions.maxNodes ?? 2_000))),
  }
}

export function visualLabLinkIndices (
  state: DemoRuntimeState,
  graph: Graph,
  pointIndices: number[],
  edgeMode: GraphEdgeMode
): number[] {
  return state.currentRenderData
    ? linkIndicesForPointSet(state.currentRenderData, pointIndices, edgeMode)
    : graph.getConnectedLinkIndices(pointIndices)
}

export function buildSelectionConfig (options: SelectionConfigOptions): GraphConfig {
  const {
    currentConfig,
    buildGraphConfig,
    focusedPointIndex,
    pointIndices,
    linkIndices,
    materialize,
    restoreEmptyPointGreyout = false,
    requireNonEmptyActiveLinks = false,
  } = options
  const baseConfig = buildGraphConfig(currentConfig)
  const activeLinkIndices = materialize && (!requireNonEmptyActiveLinks || linkIndices.length > 0)
    ? linkIndices
    : undefined

  return {
    focusedPointIndex,
    focusedLinkIndex: undefined,
    highlightedPointIndices: pointIndices.length > 0 ? pointIndices : undefined,
    highlightedLinkIndices: linkIndices.length > 0 ? linkIndices : undefined,
    activePointIndices: materialize && pointIndices.length > 0 ? pointIndices : undefined,
    activeLinkIndices,
    outlinedPointIndices: undefined,
    renderLodMode: materialize ? 'exact' : baseConfig.renderLodMode,
    pointGreyoutOpacity: restoreEmptyPointGreyout && pointIndices.length === 0
      ? baseConfig.pointGreyoutOpacity
      : (currentConfig.theme === 'light' ? 0.10 : 0.14),
    linkGreyoutOpacity: currentConfig.theme === 'light' ? 0.05 : 0.07,
  }
}

export function buildClearInteractionConfig (options: VisualLabConfigOptions): GraphConfig {
  const baseConfig = options.buildGraphConfig(options.currentConfig)
  return {
    focusedPointIndex: undefined,
    focusedLinkIndex: undefined,
    highlightedPointIndices: undefined,
    highlightedLinkIndices: undefined,
    activePointIndices: undefined,
    activeLinkIndices: undefined,
    outlinedPointIndices: undefined,
    renderLodMode: baseConfig.renderLodMode,
    pointGreyoutOpacity: baseConfig.pointGreyoutOpacity,
    linkGreyoutOpacity: baseConfig.linkGreyoutOpacity,
  }
}

export function fitVisualLabSelection (
  graph: Graph,
  rootNode: number,
  pointIndices: number[],
  fit: boolean | undefined
): void {
  if (fit === false) return
  if (pointIndices.length <= 2) {
    graph.zoomToPointByIndex(rootNode, 300, Math.max(4.4, graph.getZoomLevel()), false, false)
  } else {
    graph.fitViewByPointIndices(pointIndices, 320, 0.24, false)
  }
}
