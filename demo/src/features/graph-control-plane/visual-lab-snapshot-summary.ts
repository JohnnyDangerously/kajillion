import {
  EDGE_CODE_TO_KIND,
  type GraphFrame,
  type GraphSnapshot,
} from '../../graph-contract'
import type { GraphSnapshotSummary } from './visual-lab-control-types'

export function summarizeSnapshot (snapshot: GraphSnapshot, frame?: GraphFrame | null): GraphSnapshotSummary {
  const edgeKindCounts = new Map<number, number>()
  for (const kind of snapshot.edges.kind) {
    edgeKindCounts.set(kind, (edgeKindCounts.get(kind) ?? 0) + 1)
  }
  const nodeColumns = frame
    ? Object.entries(frame.node).filter(([, value]) => value !== undefined).map(([key]) => `node.${key}`)
    : Object.entries(snapshot.nodes).filter(([, value]) => value !== undefined).map(([key]) => `node.${key}`)
  const edgeColumns = frame
    ? Object.entries(frame.edge).filter(([, value]) => value !== undefined).map(([key]) => `edge.${key}`)
    : Object.entries(snapshot.edges).filter(([, value]) => value !== undefined).map(([key]) => `edge.${key}`)
  return {
    snapshotId: snapshot.metadata.snapshotId,
    datasetId: snapshot.metadata.datasetId,
    graphId: snapshot.metadata.graphId,
    nodeCount: snapshot.metadata.nodeCount,
    edgeCount: snapshot.metadata.edgeCount,
    directed: snapshot.metadata.directed,
    layouts: Object.keys(snapshot.layouts),
    nodeColumns,
    edgeColumns,
    edgeKinds: [...edgeKindCounts.entries()].map(([kind, count]) => ({
      kind: EDGE_CODE_TO_KIND[kind] ?? `unknown:${kind}`,
      count,
    })),
  }
}
