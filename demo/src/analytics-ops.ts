import {
  EDGE_CODE_TO_KIND,
  type GraphEdgeKind,
  type GraphSnapshot,
} from './graph-contract'

interface SecondDegreeOptions {
  minSharedNeighbors?: number;
  topKPerNode?: number;
  maxNodes?: number;
  maxNewEdges?: number;
}

const EDGE_KIND_CODE: Record<GraphEdgeKind, number> = {
  observed: 0,
  second_degree: 1,
  predicted: 2,
}

interface CandidateEdge {
  source: number;
  target: number;
  sharedNeighbors: number;
  score: number;
}

export function projectSecondDegreeCandidates (
  snapshot: GraphSnapshot,
  options: SecondDegreeOptions = {}
): GraphSnapshot {
  const minSharedNeighbors = options.minSharedNeighbors ?? 2
  const topKPerNode = options.topKPerNode ?? 8
  const maxNodes = options.maxNodes ?? 10_000
  const maxNewEdges = options.maxNewEdges ?? 250_000
  const nodeCount = snapshot.metadata.nodeCount
  if (nodeCount > maxNodes) {
    throw new Error(`second-degree projection refused ${nodeCount} nodes; maxNodes is ${maxNodes}`)
  }

  const adjacency = Array.from({ length: nodeCount }, () => new Set<number>())
  const observed = new Set<string>()
  for (let i = 0; i < snapshot.metadata.edgeCount; i += 1) {
    const a = snapshot.edges.source[i] ?? 0
    const b = snapshot.edges.target[i] ?? 0
    if (a === b) continue
    adjacency[a]?.add(b)
    adjacency[b]?.add(a)
    observed.add(edgeKey(a, b))
  }

  const candidates: CandidateEdge[] = []
  const seenCandidates = new Set<string>()
  const futureClosenessScore = new Float32Array(nodeCount)
  for (let node = 0; node < nodeCount; node += 1) {
    const neighbors = adjacency[node]
    if (!neighbors || neighbors.size === 0) continue
    const sharedCounts = new Map<number, number>()
    for (const neighbor of neighbors) {
      const nextNeighbors = adjacency[neighbor]
      if (!nextNeighbors) continue
      for (const second of nextNeighbors) {
        if (second === node || neighbors.has(second)) continue
        sharedCounts.set(second, (sharedCounts.get(second) ?? 0) + 1)
      }
    }
    const ranked = [...sharedCounts.entries()]
      .filter(([, shared]) => shared >= minSharedNeighbors)
      .map(([target, shared]) => {
        const targetDegree = adjacency[target]?.size ?? 1
        const score = shared / Math.sqrt(Math.max(1, neighbors.size * targetDegree))
        return { target, shared, score }
      })
      .sort((a, b) => b.score - a.score || b.shared - a.shared)
      .slice(0, topKPerNode)
    for (const item of ranked) {
      const low = Math.min(node, item.target)
      const high = Math.max(node, item.target)
      const key = edgeKey(low, high)
      if (observed.has(key) || seenCandidates.has(key)) continue
      seenCandidates.add(key)
      futureClosenessScore[node] = Math.max(futureClosenessScore[node] ?? 0, item.score)
      futureClosenessScore[item.target] = Math.max(futureClosenessScore[item.target] ?? 0, item.score)
      candidates.push({
        source: low,
        target: high,
        sharedNeighbors: item.shared,
        score: item.score,
      })
      if (candidates.length >= maxNewEdges) break
    }
    if (candidates.length >= maxNewEdges) break
  }

  const oldEdgeCount = snapshot.metadata.edgeCount
  const nextEdgeCount = oldEdgeCount + candidates.length
  const source = new Uint32Array(nextEdgeCount)
  const target = new Uint32Array(nextEdgeCount)
  const weight = new Float32Array(nextEdgeCount)
  const kind = new Uint8Array(nextEdgeCount)
  const confidence = new Float32Array(nextEdgeCount)
  const sharedNeighbors = new Uint16Array(nextEdgeCount)
  source.set(snapshot.edges.source)
  target.set(snapshot.edges.target)
  weight.set(snapshot.edges.weight)
  kind.set(snapshot.edges.kind)
  if (snapshot.edges.confidence) confidence.set(snapshot.edges.confidence)
  if (snapshot.edges.sharedNeighbors) sharedNeighbors.set(snapshot.edges.sharedNeighbors)

  for (const [i, candidate_] of candidates.entries()) {
    const candidate = candidate_!
    const edgeIndex = oldEdgeCount + i
    source[edgeIndex] = candidate.source
    target[edgeIndex] = candidate.target
    weight[edgeIndex] = candidate.sharedNeighbors
    kind[edgeIndex] = EDGE_KIND_CODE.second_degree
    confidence[edgeIndex] = Math.max(0, Math.min(1, candidate.score))
    sharedNeighbors[edgeIndex] = Math.min(65_535, candidate.sharedNeighbors)
  }

  return {
    ...snapshot,
    metadata: {
      ...snapshot.metadata,
      snapshotId: `${snapshot.metadata.snapshotId}:2hop:${minSharedNeighbors}:${topKPerNode}`,
      edgeCount: nextEdgeCount,
      lineage: {
        ...snapshot.metadata.lineage,
        generator: `${snapshot.metadata.lineage?.generator ?? 'unknown'}+secondDegreeProjection`,
      },
    },
    nodes: {
      ...snapshot.nodes,
      futureClosenessScore,
    },
    edges: {
      source,
      target,
      weight,
      kind,
      confidence,
      sharedNeighbors,
    },
  }
}

export function summarizeEdgeKinds (snapshot: GraphSnapshot): Array<{ kind: GraphEdgeKind | string; count: number }> {
  const counts = new Map<number, number>()
  for (const kind of snapshot.edges.kind) {
    counts.set(kind, (counts.get(kind) ?? 0) + 1)
  }
  return [...counts.entries()].map(([kind, count]) => ({
    kind: EDGE_CODE_TO_KIND[kind] ?? `unknown:${kind}`,
    count,
  }))
}

function edgeKey (a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}
