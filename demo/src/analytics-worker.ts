import { projectSecondDegreeCandidates } from './analytics-ops'
import type { GraphSnapshot } from './graph-contract'

interface ProjectSecondDegreeRequest {
  id: number;
  type: 'projectSecondDegree';
  snapshot: GraphSnapshot;
  options: {
    minSharedNeighbors?: number;
    topKPerNode?: number;
    maxNodes?: number;
    maxNewEdges?: number;
  };
}

interface CacheSnapshotRequest {
  id: number;
  type: 'cacheSnapshot';
  snapshot: GraphSnapshot;
}

interface ExpandNeighborhoodRequest {
  id: number;
  type: 'expandNeighborhood';
  snapshotId: string;
  rootNode: number;
  options: {
    hops?: number;
    maxNodes?: number;
  };
}

type AnalyticsWorkerRequest = ProjectSecondDegreeRequest | CacheSnapshotRequest | ExpandNeighborhoodRequest

interface AnalyticsWorkerSuccess {
  id: number;
  ok: true;
  snapshot: GraphSnapshot;
}

interface AnalyticsWorkerAck {
  id: number;
  ok: true;
}

interface AnalyticsWorkerExpansion {
  id: number;
  ok: true;
  expansion: {
    rootNode: number;
    hops: number;
    pointIndices: number[];
    linkIndices: number[];
  };
}

interface AnalyticsWorkerFailure {
  id: number;
  ok: false;
  error: string;
}

type AnalyticsWorkerResponse = AnalyticsWorkerSuccess | AnalyticsWorkerAck | AnalyticsWorkerExpansion | AnalyticsWorkerFailure

interface CachedAdjacency {
  snapshotId: string;
  nodeCount: number;
  neighbors: number[][];
  incidentLinks: number[][];
  source: Uint32Array;
  target: Uint32Array;
}

let cachedAdjacency: CachedAdjacency | null = null

function cacheSnapshot (snapshot: GraphSnapshot): void {
  const nodeCount = snapshot.metadata.nodeCount
  const edgeCount = snapshot.metadata.edgeCount
  const neighbors = Array.from({ length: nodeCount }, () => [] as number[])
  const incidentLinks = Array.from({ length: nodeCount }, () => [] as number[])
  for (let i = 0; i < edgeCount; i += 1) {
    const source = snapshot.edges.source[i] ?? 0
    const target = snapshot.edges.target[i] ?? 0
    if (source >= nodeCount || target >= nodeCount) continue
    neighbors[source]?.push(target)
    neighbors[target]?.push(source)
    incidentLinks[source]?.push(i)
    incidentLinks[target]?.push(i)
  }
  cachedAdjacency = {
    snapshotId: snapshot.metadata.snapshotId,
    nodeCount,
    neighbors,
    incidentLinks,
    source: snapshot.edges.source,
    target: snapshot.edges.target,
  }
}

function expandNeighborhood (
  snapshotId: string,
  rootNode: number,
  options: ExpandNeighborhoodRequest['options']
): AnalyticsWorkerExpansion['expansion'] {
  const cache = cachedAdjacency
  if (!cache || cache.snapshotId !== snapshotId) {
    throw new Error(`snapshot ${snapshotId} is not cached in analytics worker`)
  }
  const hops = Math.max(0, Math.min(4, Math.trunc(options.hops ?? 1)))
  const maxNodes = Math.max(1, Math.min(50_000, Math.trunc(options.maxNodes ?? 2_000)))
  if (rootNode < 0 || rootNode >= cache.nodeCount) {
    return { rootNode, hops, pointIndices: [], linkIndices: [] }
  }
  const visited = new Set<number>([rootNode])
  let frontier = [rootNode]
  for (let hop = 0; hop < hops && frontier.length > 0 && visited.size < maxNodes; hop += 1) {
    const next: number[] = []
    for (const point of frontier) {
      for (const neighbor of cache.neighbors[point] ?? []) {
        if (visited.has(neighbor)) continue
        visited.add(neighbor)
        next.push(neighbor)
        if (visited.size >= maxNodes) break
      }
      if (visited.size >= maxNodes) break
    }
    frontier = next
  }

  const pointSet = visited
  const linkSet = new Set<number>()
  for (const point of pointSet) {
    for (const linkIndex of cache.incidentLinks[point] ?? []) {
      const source = cache.source[linkIndex] ?? -1
      const target = cache.target[linkIndex] ?? -1
      if (pointSet.has(source) && pointSet.has(target)) linkSet.add(linkIndex)
    }
  }

  return {
    rootNode,
    hops,
    pointIndices: [...pointSet],
    linkIndices: [...linkSet].sort((a, b) => a - b),
  }
}

self.onmessage = (event: MessageEvent<AnalyticsWorkerRequest>) => {
  const request = event.data
  try {
    if (request.type === 'cacheSnapshot') {
      cacheSnapshot(request.snapshot)
      const response: AnalyticsWorkerResponse = { id: request.id, ok: true }
      self.postMessage(response)
      return
    }
    if (request.type === 'expandNeighborhood') {
      const expansion = expandNeighborhood(request.snapshotId, request.rootNode, request.options)
      const response: AnalyticsWorkerResponse = { id: request.id, ok: true, expansion }
      self.postMessage(response)
      return
    }
    if (request.type === 'projectSecondDegree') {
      const snapshot = projectSecondDegreeCandidates(request.snapshot, request.options)
      const response: AnalyticsWorkerResponse = { id: request.id, ok: true, snapshot }
      self.postMessage(response)
      return
    }
    const response: AnalyticsWorkerResponse = { id: request.id, ok: false, error: `Unknown analytics request: ${(request as { type?: string }).type ?? 'missing'}` }
    self.postMessage(response)
  } catch (error) {
    const response: AnalyticsWorkerResponse = {
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
    self.postMessage(response)
  }
}
