import type { Graph } from '@kajillion/graph'
import type { GeneratedGraph } from '../../../generate-graph'

export type GraphEdgeMode = 'inside' | 'incident'

type NeighborReader = Pick<Graph, 'getNeighboringPointIndices'>

export function sampleIndices (indices: number[], limit = 80): number[] {
  return indices.length <= limit ? [...indices] : indices.slice(0, limit)
}

export function directLinkIndicesForPoint (data: Pick<GeneratedGraph, 'links' | 'edgeCount'>, index: number): number[] {
  const links: number[] = []
  for (let i = 0; i < data.edgeCount; i += 1) {
    const a = data.links[i * 2] ?? -1
    const b = data.links[i * 2 + 1] ?? -1
    if (a === index || b === index) links.push(i)
  }
  return links
}

export function secondDegreeForPoint (graph: NeighborReader, index: number, neighbors: number[]): number[] {
  const first = new Set(neighbors)
  const second = new Set<number>()
  for (const neighbor of neighbors) {
    for (const candidate of graph.getNeighboringPointIndices(neighbor)) {
      if (candidate !== index && !first.has(candidate)) second.add(candidate)
    }
  }
  return [...second]
}

export function boundedNeighborhoodForNode (
  graph: NeighborReader,
  rootIndex: number,
  hops: number,
  maxNodes: number,
  nodeCount: number
): number[] {
  if (rootIndex < 0 || rootIndex >= nodeCount) return []
  const visited = new Set<number>([rootIndex])
  let frontier = [rootIndex]
  for (let hop = 0; hop < hops && frontier.length > 0 && visited.size < maxNodes; hop += 1) {
    const next: number[] = []
    for (const pointIndex of frontier) {
      const neighbors = graph.getNeighboringPointIndices(pointIndex)
      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue
        visited.add(neighbor)
        next.push(neighbor)
        if (visited.size >= maxNodes) break
      }
      if (visited.size >= maxNodes) break
    }
    frontier = next
  }
  return [...visited]
}

export function nodeMaskFromIndices (pointIndices: number[], nodeCount: number): Uint8Array {
  const mask = new Uint8Array(nodeCount)
  for (const index of pointIndices) {
    if (index >= 0 && index < nodeCount) mask[index] = 1
  }
  return mask
}

export function linkIndicesForPointSet (
  data: Pick<GeneratedGraph, 'links' | 'edgeCount'>,
  pointIndices: number[],
  edgeMode: GraphEdgeMode
): number[] {
  const pointSet = new Set(pointIndices)
  const linkIndices: number[] = []
  for (let i = 0; i < data.edgeCount; i += 1) {
    const a = data.links[i * 2] ?? -1
    const b = data.links[i * 2 + 1] ?? -1
    const aVisible = pointSet.has(a)
    const bVisible = pointSet.has(b)
    if (edgeMode === 'incident' ? aVisible || bVisible : aVisible && bVisible) {
      linkIndices.push(i)
    }
  }
  return linkIndices
}

export function pointPositionsForIndices (
  data: Pick<GeneratedGraph, 'positions' | 'nodeCount'>,
  indices: number[]
): Float32Array | null {
  const unique = indices.length > 0 ? [...new Set(indices)] : Array.from({ length: data.nodeCount }, (_, index) => index)
  const positions = new Float32Array(unique.length * 2)
  let cursor = 0
  for (const index of unique) {
    if (index < 0 || index >= data.nodeCount) continue
    const x = data.positions[index * 2]
    const y = data.positions[index * 2 + 1]
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    positions[cursor * 2] = x!
    positions[cursor * 2 + 1] = y!
    cursor += 1
  }
  if (cursor === 0) return null
  return cursor === unique.length ? positions : positions.slice(0, cursor * 2)
}
