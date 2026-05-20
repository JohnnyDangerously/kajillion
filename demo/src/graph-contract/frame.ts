import type { GeneratedGraph } from '../generate-graph'
import { EDGE_CODE_TO_KIND, EDGE_KIND_TO_CODE } from './edge-kinds'
import type {
  GraphEdgeKind,
  GraphFrame,
  GraphFrameVisibilityFilter,
  GraphLayoutName,
  GraphSnapshot,
  RenderableGraphData,
} from './types'

export function graphFrameFromSnapshot (snapshot: GraphSnapshot, layout: GraphLayoutName): GraphFrame {
  const positions = snapshot.layouts[layout] ?? snapshot.layouts.force2d
  if (!positions) {
    throw new Error(`GraphSnapshot ${snapshot.metadata.snapshotId} does not include layout "${layout}"`)
  }
  const links = new Float32Array(snapshot.metadata.edgeCount * 2)
  for (let i = 0; i < snapshot.metadata.edgeCount; i += 1) {
    links[i * 2] = snapshot.edges.source[i] ?? 0
    links[i * 2 + 1] = snapshot.edges.target[i] ?? 0
  }
  return {
    snapshotId: snapshot.metadata.snapshotId,
    nodeCount: snapshot.metadata.nodeCount,
    edgeCount: snapshot.metadata.edgeCount,
    positions,
    links,
    node: {
      ids: snapshot.nodes.ids,
      labels: snapshot.nodes.labels,
      degree: snapshot.nodes.degree,
      indegree: snapshot.nodes.indegree,
      outdegree: snapshot.nodes.outdegree,
      community: snapshot.nodes.community,
      futureClosenessScore: snapshot.nodes.futureClosenessScore,
    },
    edge: {
      source: snapshot.edges.source,
      target: snapshot.edges.target,
      weight: snapshot.edges.weight,
      kind: snapshot.edges.kind,
      confidence: snapshot.edges.confidence,
      sharedNeighbors: snapshot.edges.sharedNeighbors,
    },
    dirtyColumns: new Set(['positions', 'links', 'node.degree', 'edge.kind']),
  }
}

export function graphFrameToGeneratedGraph (frame: GraphFrame): GeneratedGraph {
  return {
    positions: frame.positions,
    links: frame.links,
    nodeCount: frame.nodeCount,
    edgeCount: frame.edgeCount,
  }
}

export function graphFrameToVisibleGeneratedGraph (
  frame: GraphFrame,
  visibleKinds: GraphEdgeKind[],
  filter?: GraphFrameVisibilityFilter
): RenderableGraphData {
  if (visibleKinds.length === 0) {
    return {
      positions: frame.positions,
      links: new Float32Array(0),
      nodeCount: frame.nodeCount,
      edgeCount: 0,
      edgeKind: new Uint8Array(0),
      edgeWeight: new Float32Array(0),
    }
  }
  const visibleCodes = new Set<number>()
  for (const kind of visibleKinds) {
    const code = EDGE_KIND_TO_CODE[kind]
    if (code !== undefined) visibleCodes.add(code)
  }
  const pointMask = filter?.pointMask
  const edgeMode = filter?.edgeMode ?? 'inside'
  const hasPointFilter = pointMask !== undefined
  const edgePassesPointFilter = (source: number, target: number): boolean => {
    if (!pointMask) return true
    const sourceVisible = pointMask[source] === 1
    const targetVisible = pointMask[target] === 1
    return edgeMode === 'incident'
      ? sourceVisible || targetVisible
      : sourceVisible && targetVisible
  }
  if (!hasPointFilter && visibleCodes.size === EDGE_CODE_TO_KIND.length) {
    return {
      ...graphFrameToGeneratedGraph(frame),
      edgeKind: frame.edge.kind,
      edgeWeight: frame.edge.weight,
      edgeConfidence: frame.edge.confidence,
      edgeSharedNeighbors: frame.edge.sharedNeighbors,
    }
  }

  let edgeCount = 0
  for (let i = 0; i < frame.edgeCount; i += 1) {
    if (!visibleCodes.has(frame.edge.kind[i] ?? -1)) continue
    if (!edgePassesPointFilter(frame.edge.source[i] ?? -1, frame.edge.target[i] ?? -1)) continue
    edgeCount += 1
  }
  const links = new Float32Array(edgeCount * 2)
  const edgeKind = new Uint8Array(edgeCount)
  const edgeWeight = new Float32Array(edgeCount)
  const edgeConfidence = frame.edge.confidence ? new Float32Array(edgeCount) : undefined
  const edgeSharedNeighbors = frame.edge.sharedNeighbors ? new Uint16Array(edgeCount) : undefined
  let cursor = 0
  for (let i = 0; i < frame.edgeCount; i += 1) {
    if (!visibleCodes.has(frame.edge.kind[i] ?? -1)) continue
    if (!edgePassesPointFilter(frame.edge.source[i] ?? -1, frame.edge.target[i] ?? -1)) continue
    links[cursor * 2] = frame.edge.source[i] ?? 0
    links[cursor * 2 + 1] = frame.edge.target[i] ?? 0
    edgeKind[cursor] = frame.edge.kind[i] ?? 0
    edgeWeight[cursor] = frame.edge.weight[i] ?? 1
    if (edgeConfidence) edgeConfidence[cursor] = frame.edge.confidence?.[i] ?? 0
    if (edgeSharedNeighbors) edgeSharedNeighbors[cursor] = frame.edge.sharedNeighbors?.[i] ?? 0
    cursor += 1
  }
  return {
    positions: frame.positions,
    links,
    nodeCount: frame.nodeCount,
    edgeCount,
    edgeKind,
    edgeWeight,
    edgeConfidence,
    edgeSharedNeighbors,
  }
}
