import type { GeneratedGraph } from '../../generate-graph'
import {
  WORK_NODE_PERSON,
  WORK_NODE_ROOT,
  type WorkGraphData,
} from './types'

export interface WorkNetworkNodeMetadata {
  entityIds: number[];
  scores: number[];
}

export function applyWorkNetworkNodeMetadata (
  data: GeneratedGraph | null,
  metadata: WorkNetworkNodeMetadata
): void {
  if (!data) return
  const workData = data as WorkGraphData
  const nodeCount = data.nodeCount
  const groupForNode = new Int32Array(nodeCount)
  const nodeKind = new Uint8Array(nodeCount)
  const nodeScore = new Float32Array(nodeCount)
  const nodeCompany = new Int32Array(nodeCount)
  const nodeLabels = new Array<string>(nodeCount)
  const nodeSubtitles = new Array<string>(nodeCount)
  groupForNode.fill(-1)
  nodeCompany.fill(-1)

  for (let i = 0; i < nodeCount; i += 1) {
    const entityId = metadata.entityIds[i]
    const score = metadata.scores[i] ?? 0
    nodeKind[i] = i === 0 ? WORK_NODE_ROOT : WORK_NODE_PERSON
    nodeScore[i] = i === 0 ? 1 : Math.max(0.05, Math.min(1, score / 100))
    nodeLabels[i] = entityId !== undefined ? `#${entityId}` : `Node ${i}`
    nodeSubtitles[i] = i === 0
      ? 'current network focus'
      : `tie score ${score.toFixed(0)}`
  }

  workData.groupForNode = groupForNode
  workData.nodeKind = nodeKind
  workData.nodeScore = nodeScore
  workData.nodeCompany = nodeCompany
  workData.nodeLabels = nodeLabels
  workData.nodeSubtitles = nodeSubtitles
}
