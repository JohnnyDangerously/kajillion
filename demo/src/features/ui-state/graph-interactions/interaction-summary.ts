import type { GraphInteractionSummary } from '../../../visual-lab-control-plane'
import { sampleIndices } from './neighborhood'

export function graphInteractionSummary (
  mode: GraphInteractionSummary['mode'],
  pointIndices: number[],
  linkIndices: number[],
  filtered: boolean,
  materialized: boolean,
  rootNode?: number,
  hops?: number,
  linkCount = linkIndices.length
): GraphInteractionSummary {
  return {
    mode,
    rootNode,
    hops,
    nodeCount: pointIndices.length,
    linkCount,
    filtered,
    materialized,
    samplePointIndices: sampleIndices(pointIndices),
    sampleLinkIndices: sampleIndices(linkIndices),
  }
}
