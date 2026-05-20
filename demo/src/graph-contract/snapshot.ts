import type { GeneratedGraph } from '../generate-graph'
import { EDGE_KIND_TO_CODE } from './edge-kinds'
import type { GraphSnapshot } from './types'

export function generatedGraphToSnapshot (
  graph: GeneratedGraph,
  options: {
    datasetId: string;
    graphId: string;
    title?: string;
    generator: string;
    seed?: number;
    sourceSpaceSize?: number;
    directed?: boolean;
  }
): GraphSnapshot {
  const nodeCount = graph.nodeCount
  const edgeCount = graph.edgeCount
  const graphNodeLabels = (graph as GeneratedGraph & { nodeLabels?: string[] }).nodeLabels
  const ids = new Array<string>(nodeCount)
  const labels = new Array<string>(nodeCount)
  for (let i = 0; i < nodeCount; i += 1) {
    ids[i] = String(i)
    labels[i] = graphNodeLabels?.[i] ?? String(i)
  }

  const source = new Uint32Array(edgeCount)
  const target = new Uint32Array(edgeCount)
  const weight = new Float32Array(edgeCount)
  const kind = new Uint8Array(edgeCount)
  const graphEdgeKind = (graph as GeneratedGraph & { edgeKind?: Uint8Array }).edgeKind
  const graphEdgeWeight = (graph as GeneratedGraph & { edgeWeight?: Float32Array }).edgeWeight
  const graphEdgeConfidence = (graph as GeneratedGraph & { edgeConfidence?: Float32Array }).edgeConfidence
  const confidence = graphEdgeConfidence ? new Float32Array(edgeCount) : undefined
  const degree = new Uint32Array(nodeCount)
  const indegree = new Uint32Array(nodeCount)
  const outdegree = new Uint32Array(nodeCount)
  const communities = new Uint32Array(nodeCount)
  weight.fill(1)
  kind.fill(EDGE_KIND_TO_CODE.observed)

  for (let i = 0; i < edgeCount; i += 1) {
    const a = Math.max(0, Math.min(nodeCount - 1, Math.trunc(graph.links[i * 2] ?? 0)))
    const b = Math.max(0, Math.min(nodeCount - 1, Math.trunc(graph.links[i * 2 + 1] ?? a)))
    source[i] = a
    target[i] = b
    weight[i] = graphEdgeWeight?.[i] ?? 1
    kind[i] = graphEdgeKind?.[i] ?? EDGE_KIND_TO_CODE.observed
    if (confidence) confidence[i] = graphEdgeConfidence?.[i] ?? 0
    degree[a] += 1
    degree[b] += 1
    outdegree[a] += 1
    indegree[b] += 1
  }

  for (let i = 0; i < nodeCount; i += 1) {
    communities[i] = degree[i] % 8
  }

  return {
    metadata: {
      schemaVersion: '0.1',
      snapshotId: `${options.datasetId}:${options.graphId}:${nodeCount}:${edgeCount}`,
      datasetId: options.datasetId,
      graphId: options.graphId,
      title: options.title,
      directed: options.directed ?? false,
      nodeCount,
      edgeCount,
      availableLayouts: ['force2d'],
      createdAt: new Date().toISOString(),
      lineage: {
        generator: options.generator,
        seed: options.seed,
        sourceSpaceSize: options.sourceSpaceSize,
      },
    },
    nodes: {
      ids,
      labels,
      degree,
      indegree,
      outdegree,
      community: communities,
    },
    edges: {
      source,
      target,
      weight,
      kind,
      confidence,
    },
    layouts: {
      force2d: graph.positions,
    },
  }
}
