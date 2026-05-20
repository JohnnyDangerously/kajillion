import type { GraphConfig } from '@kajillion/graph'
import type { DemoConfig } from '../control-plane/types'
import {
  boundedNeighborhoodForNode,
  graphInteractionSummary,
} from '../ui-state/graph-interactions'
import type {
  GraphInteractionSummary,
  NeighborhoodExpansion,
  NodeFilterOptions,
  NodeFocusOptions,
} from '../../visual-lab-control-plane'
import type { DemoRuntimeState, VisualLabRuntimeActions } from './context'
import {
  buildClearInteractionConfig,
  buildSelectionConfig,
  clampFocusOptions,
  fitVisualLabSelection,
  focusFilterState,
  validPointIndices,
  visualLabLinkIndices,
} from './visual-lab-action-helpers'

interface VisualLabActionsOptions {
  state: DemoRuntimeState;
  buildGraphConfig: (cfg: DemoConfig) => GraphConfig;
  applyFrameToCurrentGraph: () => void;
}

export function createVisualLabActions (
  options: VisualLabActionsOptions
): VisualLabRuntimeActions {
  const { state, buildGraphConfig, applyFrameToCurrentGraph } = options

  const setNodeFilter = (
    pointIndices: number[],
    actionOptions: NodeFilterOptions = {}
  ): GraphInteractionSummary | null => {
    const graph = state.currentGraph
    const frame = state.currentFrame
    if (!graph || !frame) return null
    const validPoints = validPointIndices(pointIndices, frame.nodeCount)
    const materialize = actionOptions.materialize === true
    const edgeMode = actionOptions.edgeMode ?? 'inside'
    state.labNodeFilterMask = null
    state.labNodeFilterEdgeMode = edgeMode
    const linkIndices = visualLabLinkIndices(state, graph, validPoints, edgeMode)
    graph.setConfigPartial(
      buildSelectionConfig({
        currentConfig: state.currentConfig,
        buildGraphConfig,
        pointIndices: validPoints,
        linkIndices,
        materialize,
        restoreEmptyPointGreyout: true,
        requireNonEmptyActiveLinks: true,
      })
    )
    if (actionOptions.fit !== false && validPoints.length > 0) {
      graph.fitViewByPointIndices(validPoints, 320, 0.24, false)
    }
    state.labInteractionState = graphInteractionSummary(
      'filter',
      validPoints,
      linkIndices,
      validPoints.length > 0,
      materialize,
      undefined,
      undefined,
      linkIndices.length
    )
    graph.render()
    return state.labInteractionState
  }

  const focusNode = (
    index: number,
    actionOptions: NodeFocusOptions = {}
  ): GraphInteractionSummary | null => {
    const graph = state.currentGraph
    if (!graph) return null
    const { hops, maxNodes } = clampFocusOptions(actionOptions)
    const nodeCount = state.currentRenderData?.nodeCount ?? state.currentData?.nodeCount ?? 0
    const pointIndices = boundedNeighborhoodForNode(graph, index, hops, maxNodes, nodeCount)
    if (pointIndices.length === 0) return null

    const { shouldFilter, materialize } = focusFilterState(actionOptions.filter)
    if (shouldFilter) {
      setNodeFilter(pointIndices, { fit: false, edgeMode: 'inside', materialize })
    }

    const linkIndices = visualLabLinkIndices(state, graph, pointIndices, 'inside')
    graph.setConfigPartial(
      buildSelectionConfig({
        currentConfig: state.currentConfig,
        buildGraphConfig,
        focusedPointIndex: index,
        pointIndices,
        linkIndices,
        materialize,
      })
    )
    fitVisualLabSelection(graph, index, pointIndices, actionOptions.fit)
    state.labInteractionState = graphInteractionSummary(
      'focus',
      pointIndices,
      linkIndices,
      shouldFilter,
      materialize,
      index,
      hops,
      linkIndices.length
    )
    graph.render()
    return state.labInteractionState
  }

  const applyNodeExpansion = (
    expansion: NeighborhoodExpansion,
    actionOptions: NodeFocusOptions = {}
  ): GraphInteractionSummary | null => {
    const graph = state.currentGraph
    if (!graph) return null
    const pointIndices = expansion.pointIndices
    const linkIndices = expansion.linkIndices
    if (pointIndices.length === 0) return null
    const { shouldFilter, materialize } = focusFilterState(actionOptions.filter)
    graph.setConfigPartial(
      buildSelectionConfig({
        currentConfig: state.currentConfig,
        buildGraphConfig,
        focusedPointIndex: expansion.rootNode,
        pointIndices,
        linkIndices,
        materialize,
      })
    )
    fitVisualLabSelection(graph, expansion.rootNode, pointIndices, actionOptions.fit)
    state.labInteractionState = graphInteractionSummary(
      'focus',
      pointIndices,
      linkIndices,
      shouldFilter,
      materialize,
      expansion.rootNode,
      expansion.hops,
      linkIndices.length
    )
    graph.render()
    return state.labInteractionState
  }

  const clearInteraction = (): void => {
    const graph = state.currentGraph
    state.labNodeFilterMask = null
    state.labNodeFilterEdgeMode = 'inside'
    state.labInteractionState = null
    if (!graph) return
    applyFrameToCurrentGraph()
    graph.setConfigPartial(buildClearInteractionConfig({
      currentConfig: state.currentConfig,
      buildGraphConfig,
    }))
    graph.render()
  }

  return {
    focusNode,
    applyNodeExpansion,
    setNodeFilter,
    clearInteraction,
  }
}
