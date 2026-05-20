import type { GeneratedGraph } from '../../generate-graph'
import type { AgentGraphPayload } from './types'

export interface AgentGraphPayloadOptions {
  spaceSize: number;
}

export function finiteNumber (value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function agentGraphPayloadToGeneratedGraph (
  payload: AgentGraphPayload,
  options: AgentGraphPayloadOptions
): GeneratedGraph {
  if (Array.isArray(payload.positions) && Array.isArray(payload.links)) {
    const nodeCount = payload.nodeCount ?? Math.floor(payload.positions.length / 2)
    const edgeCount = payload.edgeCount ?? Math.floor(payload.links.length / 2)
    if (nodeCount < 0 || edgeCount < 0) throw new Error('nodeCount and edgeCount must be non-negative')
    if (payload.positions.length < nodeCount * 2) throw new Error('positions length is shorter than nodeCount * 2')
    if (payload.links.length < edgeCount * 2) throw new Error('links length is shorter than edgeCount * 2')
    return {
      positions: new Float32Array(payload.positions.slice(0, nodeCount * 2)),
      links: new Float32Array(payload.links.slice(0, edgeCount * 2)),
      nodeCount,
      edgeCount,
    }
  }

  if (!Array.isArray(payload.nodes) || !Array.isArray(payload.edges)) {
    throw new Error('loadGraph expects either {positions, links} or {nodes, edges}')
  }

  const nodes = payload.nodes
  const edges = payload.edges
  const nodeCount = nodes.length
  const positions = new Float32Array(nodeCount * 2)
  const idToIndex = new Map<string, number>()
  for (let i = 0; i < nodeCount; i += 1) {
    const node = nodes[i] ?? {}
    idToIndex.set(String(node.id ?? i), i)
    const hasPosition = finiteNumber(node.x) && finiteNumber(node.y)
    if (hasPosition) {
      positions[i * 2] = node.x
      positions[i * 2 + 1] = node.y
    } else {
      const angle = (i / Math.max(1, nodeCount)) * Math.PI * 2
      const radius = options.spaceSize * (0.18 + 0.22 * ((i * 2654435761 % 997) / 997))
      positions[i * 2] = options.spaceSize / 2 + Math.cos(angle) * radius
      positions[i * 2 + 1] = options.spaceSize / 2 + Math.sin(angle) * radius
    }
  }

  const links: number[] = []
  for (const edge of edges) {
    const source = typeof edge.source === 'number' ? edge.source : idToIndex.get(String(edge.source))
    const target = typeof edge.target === 'number' ? edge.target : idToIndex.get(String(edge.target))
    if (source === undefined || target === undefined) continue
    if (source < 0 || source >= nodeCount || target < 0 || target >= nodeCount) continue
    links.push(source, target)
  }

  return {
    positions,
    links: new Float32Array(links),
    nodeCount,
    edgeCount: links.length / 2,
  }
}
