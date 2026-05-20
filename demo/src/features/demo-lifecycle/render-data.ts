import { galleryRenderData } from '../../gallery-presets'
import type { GeneratedGraph } from '../../generate-graph'
import {
  graphFrameToVisibleGeneratedGraph,
  type GraphFrame,
  type GraphFrameVisibilityFilter,
  type ViewSpec,
} from '../../graph-contract'
import type { DemoConfig } from '../control-plane/types'
import type { WorkGraphData } from './work-graph-types'

export function renderDataFromFrame (
  frame: GraphFrame,
  viewSpec: ViewSpec,
  cfg: DemoConfig,
  spaceSize: number,
  filter?: GraphFrameVisibilityFilter
): GeneratedGraph {
  const frameData = graphFrameToVisibleGeneratedGraph(
    frame,
    viewSpec.edge.visibleKinds,
    filter
  )
  return galleryRenderData(cfg.palette, frameData, spaceSize)
}

export function attachWorkMetadata (target: GeneratedGraph, source: GeneratedGraph | null): GeneratedGraph {
  if (!source) return target
  const targetWork = target as WorkGraphData
  const sourceWork = source as WorkGraphData
  targetWork.groupForNode = sourceWork.groupForNode
  targetWork.nodeKind = sourceWork.nodeKind
  targetWork.nodeScore = sourceWork.nodeScore
  targetWork.nodeCompany = sourceWork.nodeCompany
  targetWork.nodeLabels = sourceWork.nodeLabels
  targetWork.nodeSubtitles = sourceWork.nodeSubtitles
  if (source.edgeCount === target.edgeCount) {
    targetWork.edgeKind = sourceWork.edgeKind
    targetWork.edgeWeight = sourceWork.edgeWeight
    targetWork.edgeConfidence = sourceWork.edgeConfidence
  }
  return target
}
