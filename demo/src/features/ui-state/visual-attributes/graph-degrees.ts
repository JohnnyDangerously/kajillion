import type { GeneratedGraph } from '../../../generate-graph'
import type { RenderableGraphData } from '../../../graph-contract'

const graphDegreeCache = new WeakMap<object, Uint16Array>()

export function graphDegrees (data: GeneratedGraph | RenderableGraphData): Uint16Array {
  const cached = graphDegreeCache.get(data)
  if (cached && cached.length === data.nodeCount) return cached
  const degrees = new Uint16Array(data.nodeCount)
  for (let i = 0; i < data.edgeCount; i += 1) {
    const a = data.links[i * 2] ?? -1
    const b = data.links[i * 2 + 1] ?? -1
    if (a >= 0 && a < data.nodeCount) degrees[a] += 1
    if (b >= 0 && b < data.nodeCount) degrees[b] += 1
  }
  graphDegreeCache.set(data, degrees)
  return degrees
}
