import type { GraphEdgeKind } from './types'

export const EDGE_KIND_TO_CODE: Record<GraphEdgeKind, number> = {
  observed: 0,
  second_degree: 1,
  predicted: 2,
}

export const EDGE_CODE_TO_KIND: GraphEdgeKind[] = ['observed', 'second_degree', 'predicted']
