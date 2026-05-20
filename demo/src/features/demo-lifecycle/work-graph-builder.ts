import type { GeneratedGraph } from '../../generate-graph'
import type { WorkGraphData } from './work-graph-types'

export interface WorkGraphBuilder {
  nodeCount: number;
  positions: Float32Array;
  groupForNode: Int32Array;
  nodeKind: Uint8Array;
  nodeScore: Float32Array;
  nodeCompany: Int32Array;
  nodeLabels: string[];
  nodeSubtitles: string[];
  links: number[];
  linkKinds: number[];
  linkWeights: number[];
  linkConfidence: number[];
  addLink: (a: number, b: number, kind?: number, weight?: number, confidence?: number) => void;
}

export function createWorkGraphBuilder (nodeCount: number): WorkGraphBuilder {
  const positions = new Float32Array(nodeCount * 2)
  const groupForNode = new Int32Array(nodeCount)
  const nodeKind = new Uint8Array(nodeCount)
  const nodeScore = new Float32Array(nodeCount)
  const nodeCompany = new Int32Array(nodeCount)
  const nodeLabels = new Array<string>(nodeCount)
  const nodeSubtitles = new Array<string>(nodeCount)
  const links: number[] = []
  const linkKinds: number[] = []
  const linkWeights: number[] = []
  const linkConfidence: number[] = []
  const seenLinks = new Set<string>()
  groupForNode.fill(-1)
  nodeCompany.fill(-1)

  const addLink = (a: number, b: number, kind = 0, weight = 1, confidence = 0): void => {
    if (a === b || a < 0 || b < 0 || a >= nodeCount || b >= nodeCount) return
    const low = Math.min(a, b)
    const high = Math.max(a, b)
    const key = `${low}:${high}`
    if (seenLinks.has(key)) return
    seenLinks.add(key)
    links.push(a, b)
    linkKinds.push(kind)
    linkWeights.push(weight)
    linkConfidence.push(confidence)
  }

  return {
    nodeCount,
    positions,
    groupForNode,
    nodeKind,
    nodeScore,
    nodeCompany,
    nodeLabels,
    nodeSubtitles,
    links,
    linkKinds,
    linkWeights,
    linkConfidence,
    addLink,
  }
}

export function buildGeneratedWorkGraph (builder: WorkGraphBuilder): GeneratedGraph {
  const graph = {
    positions: builder.positions,
    links: new Float32Array(builder.links),
    nodeCount: builder.nodeCount,
    edgeCount: builder.links.length / 2,
  }
  const workGraph = graph as WorkGraphData
  workGraph.groupForNode = builder.groupForNode
  workGraph.nodeKind = builder.nodeKind
  workGraph.nodeScore = builder.nodeScore
  workGraph.nodeCompany = builder.nodeCompany
  workGraph.nodeLabels = builder.nodeLabels
  workGraph.nodeSubtitles = builder.nodeSubtitles
  workGraph.edgeKind = new Uint8Array(builder.linkKinds)
  workGraph.edgeWeight = new Float32Array(builder.linkWeights)
  workGraph.edgeConfidence = new Float32Array(builder.linkConfidence)
  return graph
}
