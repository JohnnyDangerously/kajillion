import { type Graph } from '@kajillion/graph'
import { isWorkMode } from '../../work-mode'
import { resolveRepresentationFromUrl } from '../../representations'
import type { DemoConfig } from '../../control-plane/types'
import { attachWorkMetadata, renderDataFromFrame } from '../../demo-lifecycle/render-data'
import { DEMO_SPACE_SIZE } from '../../demo-lifecycle/demo-space'
import type { GeneratedGraph } from '../../../generate-graph'
import type {
  GraphFrame,
  GraphFrameVisibilityFilter,
  RenderableGraphData,
  ViewSpec,
} from '../../../graph-contract'
import {
  buildAnalystPointSizes as buildAnalystPointSizesForConfig,
  buildVisualAttributes as buildVisualAttributesForConfig,
  type VisualAttributes,
} from '../visual-attributes'
import { buildLabelAnchors, type LabelAnchor } from '../label-overlay/label-anchors'
import type { WorkFocusState } from '../work-focus-panel'

export type VisualAttributeApplyOptions = {
  updatePoints?: boolean;
  updateLinks?: boolean;
  pointSizesOnly?: boolean;
}

export interface FrameVisualsController {
  buildAnalystPointSizes: (data: GeneratedGraph | RenderableGraphData) => Float32Array;
  buildVisualAttributes: (data: GeneratedGraph | RenderableGraphData) => VisualAttributes;
  applyCurrentVisualAttributes: (
    graph: Graph,
    data: GeneratedGraph | RenderableGraphData,
    options?: VisualAttributeApplyOptions
  ) => void;
  applyFrameToCurrentGraph: () => void;
}

interface FrameVisualsControllerOptions {
  getCurrentConfig: () => DemoConfig;
  getCurrentGraph: () => Graph | null;
  getCurrentData: () => GeneratedGraph | null;
  getCurrentRenderData: () => GeneratedGraph | null;
  setCurrentRenderData: (data: RenderableGraphData) => void;
  getCurrentFrame: () => GraphFrame | null;
  getCurrentViewSpec: () => ViewSpec | null;
  getLabNodeFilterMask: () => Uint8Array | null;
  getLabNodeFilterEdgeMode: () => GraphFrameVisibilityFilter['edgeMode'];
  getWorkFocusState: () => WorkFocusState | undefined;
  setLabelAnchors: (anchors: LabelAnchor[]) => void;
  equalizationZoomDistance: () => number;
  overviewZoomDistance: () => number;
}

export function createFrameVisualsController (
  options: FrameVisualsControllerOptions
): FrameVisualsController {
  const buildAnalystPointSizes = (data: GeneratedGraph | RenderableGraphData): Float32Array => {
    return buildAnalystPointSizesForConfig(data, {
      config: options.getCurrentConfig(),
      equalizationZoomDistance: options.equalizationZoomDistance(),
    })
  }

  const buildVisualAttributes = (data: GeneratedGraph | RenderableGraphData): VisualAttributes => {
    const attributes = buildVisualAttributesForConfig(data, {
      config: options.getCurrentConfig(),
      equalizationZoomDistance: options.equalizationZoomDistance(),
      overviewZoomDistance: options.overviewZoomDistance(),
      workFocusState: options.getWorkFocusState(),
      spaceSize: DEMO_SPACE_SIZE,
    })
    const representation = resolveRepresentationFromUrl()
    if (representation?.transformAttributes) {
      representation.transformAttributes(data, attributes, options.getCurrentConfig())
    }
    return attributes
  }

  const applyCurrentVisualAttributes = (
    graph: Graph,
    data: GeneratedGraph | RenderableGraphData,
    applyOptions: VisualAttributeApplyOptions = {}
  ): void => {
    const updatePoints = applyOptions.updatePoints ?? true
    const updateLinks = applyOptions.updateLinks ?? true
    const currentConfig = options.getCurrentConfig()
    if (
      applyOptions.pointSizesOnly &&
      updatePoints &&
      ((currentConfig.palette === 'analyst' && currentConfig.theme === 'light') ||
        (data.nodeCount >= 10000 && currentConfig.palette !== 'analyst')) &&
      isWorkMode(currentConfig)
    ) {
      graph.setPointSizes(buildAnalystPointSizes(data))
      return
    }
    const visual = buildVisualAttributes(data)
    if (updatePoints) {
      graph.setPointColors(visual.pointColors)
      graph.setPointSizes(visual.pointSizes)
      graph.setPointShapes(visual.pointShapes)
    }
    if (updateLinks) {
      graph.setLinkColors(visual.linkColors)
      graph.setLinkWidths(visual.linkWidths)
    }
    if (!options.getWorkFocusState() && updatePoints && currentConfig.palette === 'analyst' && currentConfig.theme === 'light' && isWorkMode(currentConfig)) {
      graph.setConfigPartial({ outlinedPointIndices: undefined })
    }
  }

  const applyFrameToCurrentGraph = (): void => {
    const graph = options.getCurrentGraph()
    const frame = options.getCurrentFrame()
    const viewSpec = options.getCurrentViewSpec()
    if (!graph || !frame || !viewSpec) return
    const currentConfig = options.getCurrentConfig()
    const previousRenderData = options.getCurrentRenderData()
    const filter = options.getLabNodeFilterMask()
      ? { pointMask: options.getLabNodeFilterMask()!, edgeMode: options.getLabNodeFilterEdgeMode() }
      : undefined
    const renderData = isWorkMode(currentConfig)
      ? attachWorkMetadata(renderDataFromFrame(frame, viewSpec, currentConfig, DEMO_SPACE_SIZE, filter), options.getCurrentData())
      : renderDataFromFrame(frame, viewSpec, currentConfig, DEMO_SPACE_SIZE, filter)
    const updatePoints = !previousRenderData ||
      previousRenderData.nodeCount !== renderData.nodeCount ||
      previousRenderData.positions !== renderData.positions
    options.setCurrentRenderData(renderData)
    options.setLabelAnchors(buildLabelAnchors(renderData, currentConfig))
    if (updatePoints) {
      graph.setPointPositions(renderData.positions, isWorkMode(currentConfig) || renderData.positions !== frame.positions)
    }
    graph.setLinks(renderData.links)
    applyCurrentVisualAttributes(graph, renderData, { updatePoints, updateLinks: true })
    graph.render()
  }

  return {
    buildAnalystPointSizes,
    buildVisualAttributes,
    applyCurrentVisualAttributes,
    applyFrameToCurrentGraph,
  }
}
