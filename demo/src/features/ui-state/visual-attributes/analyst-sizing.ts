import type { DemoConfig } from '../../control-plane/types'
import {
  ANALYST_CLOSE_NODE_SIZE,
} from '../../demo-lifecycle/demo-space'
import {
  WORK_NODE_COMPANY,
  WORK_NODE_GROUP,
  WORK_NODE_ROOT,
  type WorkGraphData,
  type WorkNodeKind,
} from '../../demo-lifecycle/work-graph-types'
import type { GeneratedGraph } from '../../../generate-graph'
import type { RenderableGraphData } from '../../../graph-contract'
import { graphDegrees } from './graph-degrees'

export type AnalystPointSizeOptions = {
  config: DemoConfig;
  equalizationZoomDistance: number;
}

export function smooth01 (value: number): number {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

export function analystZoomEqualization (zoomDistance: number): number {
  return smooth01((60 - zoomDistance) / 59)
}

export function analystTierSize (
  kind: WorkNodeKind | undefined,
  degree: number,
  score: number,
  hash: number,
  equalize: number
): number {
  const isVip = kind === WORK_NODE_GROUP || kind === WORK_NODE_COMPANY || degree >= 18 || score > 0.74
  const isFirstDegree = kind === WORK_NODE_COMPANY || degree >= 8 || score > 0.44
  const overviewSize = isVip
    ? 6.25 + hash * 2.15 + Math.min(2.1, Math.sqrt(degree) * 0.18)
    : isFirstDegree
      ? 3.90 + hash * 1.10 + Math.min(1.15, Math.sqrt(degree) * 0.12)
      : 2.30 + hash * 0.92 + score * 0.62
  return overviewSize * (1 - equalize) + ANALYST_CLOSE_NODE_SIZE * equalize
}

export function analystEqualizedSize (overviewSize: number, equalize: number): number {
  return overviewSize * (1 - equalize) + ANALYST_CLOSE_NODE_SIZE * equalize
}

export function buildAnalystPointSizes (
  data: GeneratedGraph | RenderableGraphData,
  options: AnalystPointSizeOptions
): Float32Array {
  const { config } = options
  const degrees = graphDegrees(data)
  const workData = data as WorkGraphData
  const nodeKindForNode = workData.nodeKind
  const nodeScoreForNode = workData.nodeScore
  const equalize = analystZoomEqualization(options.equalizationZoomDistance)
  const isLargeWork = data.nodeCount >= 2000
  const isRankedWork = config.lod
  const isDense = config.density
  const pointSizes = new Float32Array(data.nodeCount)
  for (let i = 0; i < data.nodeCount; i += 1) {
    const hash = (Math.imul(i + 1, 2654435761) >>> 0) / 0x1_0000_0000
    const degree = degrees[i] ?? 0
    const nodeKind = nodeKindForNode?.[i] as WorkNodeKind | undefined
    const workScore = nodeScoreForNode?.[i] ?? 0
    const baseSize = isRankedWork
      ? nodeKind === WORK_NODE_ROOT
        ? 0
        : nodeKind === WORK_NODE_GROUP
          ? analystEqualizedSize((isLargeWork ? 8.4 : 10.2) + Math.min(1.2, Math.sqrt(degree) * 0.16), equalize)
          : nodeKind === WORK_NODE_COMPANY
            ? analystEqualizedSize((isLargeWork ? 6.8 : 8.8) + hash * 1.0 + Math.min(1.8, Math.sqrt(degree) * 0.26), equalize)
            : analystTierSize(nodeKind, degree, workScore, hash, equalize)
      : nodeKind === WORK_NODE_ROOT
        ? 0
        : nodeKind === WORK_NODE_GROUP
          ? 13.5
          : nodeKind === WORK_NODE_COMPANY
            ? 9.4
            : analystTierSize(nodeKind, degree, workScore, hash, equalize)
    pointSizes[i] = baseSize * (isDense ? 1.02 : 0.92)
  }
  return pointSizes
}
