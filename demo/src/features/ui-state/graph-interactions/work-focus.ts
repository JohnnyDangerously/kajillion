import type { Graph } from '@kajillion/graph'
import type { GeneratedGraph } from '../../../generate-graph'
import type { WorkFocusState } from '../work-focus-panel'
import {
  directLinkIndicesForPoint,
  secondDegreeForPoint,
} from './neighborhood'

export function buildWorkPointFocusState (
  graph: Pick<Graph, 'getConnectedLinkIndices' | 'getNeighboringPointIndices'>,
  data: Pick<GeneratedGraph, 'links' | 'edgeCount'>,
  index: number
): Extract<WorkFocusState, { type: 'point' }> {
  const neighbors = graph.getNeighboringPointIndices(index)
  const secondDegree = secondDegreeForPoint(graph, index, neighbors)
  const neighborhood = [index, ...neighbors]
  const visiblePoints = [...new Set([...neighborhood, ...secondDegree])]
  const connectedLinks = graph.getConnectedLinkIndices(neighborhood)
  const directLinks = directLinkIndicesForPoint(data, index)
  return {
    type: 'point',
    index,
    degree: neighbors.length,
    neighbors,
    secondDegree,
    connectedLinks,
    directLinks,
    neighborhood,
    visiblePoints,
  }
}

export function buildWorkLinkFocusState (
  graph: Pick<Graph, 'getConnectedPointIndices'>,
  index: number
): Extract<WorkFocusState, { type: 'link' }> {
  return { type: 'link', index, endpoints: graph.getConnectedPointIndices(index) }
}
