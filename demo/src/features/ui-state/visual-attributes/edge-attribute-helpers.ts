import {
  WORK_NODE_COMPANY,
  WORK_NODE_GROUP,
} from '../../demo-lifecycle/work-graph-types'
import type { VisualAttributeContext } from './types'

export {
  edgeBaseColorForContext,
  edgeColorScalesForContext,
  edgeEndpointParticle,
  edgeMixForContext,
  edgeResolvedColor,
} from './edge-color-helpers'
export type { EdgeColor } from './edge-color-helpers'

export function isAnalystFocusEdge (
  context: VisualAttributeContext,
  a: number,
  bIndex: number,
  projectedEdge: boolean,
  predictedEdge: boolean
): boolean {
  const { groupForNode, isAnalystPalette } = context
  return isAnalystPalette && (
    projectedEdge ||
    predictedEdge ||
    Boolean(groupForNode && ((groupForNode[a] ?? -1) === 2 || (groupForNode[a] ?? -1) === 3 || (groupForNode[bIndex] ?? -1) === 2 || (groupForNode[bIndex] ?? -1) === 3))
  )
}

export function edgeTouchesHub (
  context: VisualAttributeContext,
  options: {
    aDegree: number;
    aKind: number | undefined;
    bDegree: number;
    bKind: number | undefined;
    touchesCenter: boolean;
  }
): boolean {
  const { isWork } = context
  const { aDegree, aKind, bDegree, bKind, touchesCenter } = options
  return isWork && (
    touchesCenter ||
    aKind === WORK_NODE_GROUP ||
    bKind === WORK_NODE_GROUP ||
    aKind === WORK_NODE_COMPANY ||
    bKind === WORK_NODE_COMPANY ||
    aDegree >= 18 ||
    bDegree >= 18
  )
}

export function edgeStrengthForContext (
  context: VisualAttributeContext,
  options: {
    a: number;
    aDegree: number;
    analystFocusEdge: boolean;
    bDegree: number;
    bIndex: number;
    sameGroup: boolean | undefined;
    touchesHub: boolean;
  }
): number {
  const { config, isAnalystPalette, isCosmicPalette, isDense, isFintechPalette, isInfluencePalette, isRankedWork, isSubnetPalette, isTalentPalette, isTokyoPalette, isWork, useLanes } = context
  const { a, aDegree, analystFocusEdge, bDegree, bIndex, sameGroup, touchesHub } = options
  return isAnalystPalette
    ? isRankedWork
      ? analystFocusEdge
        ? touchesHub ? 1.30 : sameGroup ? 1.10 : 0.92
        : touchesHub ? 0.82 : sameGroup ? 0.62 : 0.38
      : analystFocusEdge ? 0.92 : sameGroup ? 0.50 : 0.32
    : isSubnetPalette
    ? isRankedWork
      ? (touchesHub ? 1.38 : sameGroup ? 1.08 : 0.92)
      : (sameGroup ? 1.04 : 0.86)
    : isCosmicPalette
      ? (aDegree > 12 || bDegree > 12 ? 1.18 : 0.74)
    : isTokyoPalette
      ? (useLanes ? 1.10 : 0.92)
      : config.palette === 'signal'
        ? 1.18
        : config.palette === 'insight'
          ? 1.26
          : isFintechPalette
            ? 1.16
            : isInfluencePalette
              ? (a === 0 || bIndex === 0 ? 1.42 : 0.84)
              : isTalentPalette
                ? 0
                : isWork
                  ? isRankedWork
                    ? (touchesHub ? 1.45 : sameGroup ? 1.14 : 0.86)
                    : (sameGroup ? 1.05 : 0.78)
                  : useLanes ? 1.32 : isDense ? 0.82 : 0.10
}

export function edgeBaseAlphaForContext (
  context: VisualAttributeContext,
  options: {
    analystFocusEdge: boolean;
    edgeStrength: number;
    sameGroup: boolean | undefined;
    touchesHub: boolean;
  }
): number {
  const { config, isAnalystPalette, isCosmicPalette, isFintechPalette, isInfluencePalette, isLargeWork, isLight, isRankedWork, isSubnetPalette, isTalentPalette, isWork, useLanes, useMassConservingLod } = context
  const { analystFocusEdge, edgeStrength, sameGroup, touchesHub } = options
  return isWork
    ? isAnalystPalette
      ? analystFocusEdge
        ? touchesHub ? 0.54 : sameGroup ? 0.36 : 0.22
        : touchesHub ? 0.20 : sameGroup ? 0.105 : 0.052
      : isRankedWork && touchesHub
      ? isSubnetPalette ? 0.76 : (isLight ? 0.58 : (isLargeWork ? 0.56 : 0.82))
      : sameGroup
        ? isSubnetPalette ? 0.56 : (isLight ? 0.38 : (isLargeWork ? 0.30 : 0.64))
        : isSubnetPalette ? 0.40 : (isLight ? 0.26 : (isLargeWork ? 0.18 : 0.46))
    : (useMassConservingLod ? 0.012 : isLight ? 0.045 : isCosmicPalette ? 0.18 : config.palette === 'ember' ? 0.11 : config.palette === 'ion' ? 0.14 : config.palette === 'signal' ? 0.42 : config.palette === 'tokyo' ? 0.38 : config.palette === 'insight' ? 0.50 : isFintechPalette ? 0.46 : isInfluencePalette ? 0.42 : isTalentPalette ? 0 : 0.18) * (useLanes ? 0.78 : edgeStrength)
}

export function edgeRawWidthForContext (
  context: VisualAttributeContext,
  options: {
    aDegree: number;
    analystFocusEdge: boolean;
    bDegree: number;
    cosmicLinkNearDepth: number;
    edgeConfidence: number;
    edgeWeight: number;
    predictedEdge: boolean;
    projectedEdge: boolean;
    sameGroup: boolean | undefined;
    touchesCenter: boolean;
    touchesHub: boolean;
  }
): number {
  const { isAnalystPalette, isCosmicPalette, isLargeWork, isRankedWork, isSubnetPalette, isWork } = context
  const { aDegree, analystFocusEdge, bDegree, cosmicLinkNearDepth, edgeConfidence, edgeWeight, predictedEdge, projectedEdge, sameGroup, touchesCenter, touchesHub } = options
  return isAnalystPalette && touchesCenter
    ? 0
    : isWork
    ? isRankedWork
      ? touchesCenter
        ? isAnalystPalette ? 2.6 : isSubnetPalette ? 5.2 : (isLargeWork ? 3.4 : 4.4)
        : touchesHub
            ? isAnalystPalette ? 1.45 : isSubnetPalette ? 3.2 : (isLargeWork ? 1.95 : 3.1)
          : sameGroup
            ? isAnalystPalette ? 0.72 : isSubnetPalette ? 1.85 : (isLargeWork ? 1.10 : 1.95)
            : isAnalystPalette ? 0.46 : isSubnetPalette ? 1.18 : (isLargeWork ? 0.72 : 1.22)
      : sameGroup ? (isAnalystPalette ? 0.68 : isSubnetPalette ? 1.8 : (isLargeWork ? 1.05 : 1.85)) : (isAnalystPalette ? 0.42 : isSubnetPalette ? 1.12 : (isLargeWork ? 0.70 : 1.18))
    : predictedEdge
      ? 1.4 + edgeConfidence * 1.8
      : projectedEdge
        ? 0.55 + Math.min(1.25, Math.log2(Math.max(1, edgeWeight)) * 0.28)
        : isCosmicPalette ? (aDegree > 12 || bDegree > 12 ? 1.18 : 0.58) * (0.62 + cosmicLinkNearDepth * 0.96) : 1
}
