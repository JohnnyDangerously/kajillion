import {
  edgeBaseAlphaForContext,
  edgeBaseColorForContext,
  edgeColorScalesForContext,
  edgeEndpointParticle,
  edgeMixForContext,
  edgeRawWidthForContext,
  edgeResolvedColor,
  edgeStrengthForContext,
  edgeTouchesHub,
  isAnalystFocusEdge,
} from './edge-attribute-helpers'
import type { VisualAttributeContext, VisualAttributeData, VisualAttributes } from './types'

export function applyEdgeVisualAttributes (
  data: VisualAttributeData,
  attributes: VisualAttributes,
  context: VisualAttributeContext
): void {
  const {
    analystOverview,
    cx,
    cy,
    degrees,
    edgeConfidenceForEdge,
    edgeKindForEdge,
    edgeWeightForEdge,
    groupForNode,
    isAnalystPalette,
    isCosmicPalette,
    isLight,
    isWork,
    nodeKindForNode,
    normalizeY,
    useGalleryPalette,
  } = context
  const { linkColors, linkWidths } = attributes

  for (let i = 0; i < data.edgeCount; i += 1) {
    const a = data.links[i * 2] ?? 0
    const bIndex = data.links[i * 2 + 1] ?? a
    const group = isWork && groupForNode
      ? Math.max(0, groupForNode[a] ?? groupForNode[bIndex] ?? 0)
      : a % 8
    const ax = data.positions[a * 2] ?? cx
    const ay = data.positions[a * 2 + 1] ?? cy
    const bx = data.positions[bIndex * 2] ?? ax
    const by = data.positions[bIndex * 2 + 1] ?? ay
    const cosmicLinkNearDepth = isCosmicPalette
      ? Math.max(0, Math.min(1, 1 - ((normalizeY(ay) + normalizeY(by)) * 0.5)))
      : 0.5
    const edgeMix = edgeMixForContext(context)
    const edgeBase = edgeBaseColorForContext(context)
    const aDegree = degrees[a] ?? 0
    const bDegree = degrees[bIndex] ?? 0
    const edgeKind = edgeKindForEdge?.[i] ?? 0
    const projectedEdge = edgeKind === 1
    const predictedEdge = edgeKind === 2
    const edgeWeight = edgeWeightForEdge?.[i] ?? 1
    const edgeConfidence = edgeConfidenceForEdge?.[i] ?? 0
    const sourceParticle = edgeEndpointParticle(context, a, group, aDegree, ax, ay)
    const targetParticle = edgeEndpointParticle(context, bIndex, group, bDegree, bx, by)
    const [r, g, b] = edgeResolvedColor(context, {
      group,
      normalizedSourceY: normalizeY(ay),
      normalizedTargetY: normalizeY(by),
      predictedEdge,
      projectedEdge,
      sourceParticle,
      targetParticle,
    })
    const analystFocusEdge = isAnalystFocusEdge(context, a, bIndex, projectedEdge, predictedEdge)
    const edgeR = (isLight && !isWork) || useGalleryPalette ? edgeBase[0] + (r - edgeBase[0]) * (analystFocusEdge ? 0.82 : edgeMix) : r
    const edgeG = (isLight && !isWork) || useGalleryPalette ? edgeBase[1] + (g - edgeBase[1]) * (analystFocusEdge ? 0.82 : edgeMix) : g
    const edgeB = (isLight && !isWork) || useGalleryPalette ? edgeBase[2] + (b - edgeBase[2]) * (analystFocusEdge ? 0.90 : edgeMix) : b
    const touchesCenter = isWork && (a === 0 || bIndex === 0)
    const aKind = nodeKindForNode?.[a]
    const bKind = nodeKindForNode?.[bIndex]
    const touchesHub = edgeTouchesHub(context, {
      aDegree,
      aKind,
      bDegree,
      bKind,
      touchesCenter,
    })
    const sameGroup = isWork && groupForNode && (groupForNode[a] ?? -2) === (groupForNode[bIndex] ?? -3)
    const analystHubDamp = isAnalystPalette && touchesHub ? 1 - analystOverview * 0.56 : 1
    const analystCommunityLift = isAnalystPalette && sameGroup && !touchesHub ? 1 + analystOverview * 0.26 : 1
    const analystMacroEdgeWeight = analystHubDamp * analystCommunityLift
    const edgeStrength = edgeStrengthForContext(context, {
      a,
      aDegree,
      analystFocusEdge,
      bDegree,
      bIndex,
      sameGroup,
      touchesHub,
    })
    const [scaleR, scaleG, scaleB] = edgeColorScalesForContext(context)
    linkColors[i * 4] = Math.min(1, edgeR * scaleR * edgeStrength)
    linkColors[i * 4 + 1] = Math.min(1, edgeG * scaleG * edgeStrength)
    linkColors[i * 4 + 2] = Math.min(1, edgeB * scaleB * edgeStrength)
    const baseAlpha = edgeBaseAlphaForContext(context, {
      analystFocusEdge,
      edgeStrength,
      sameGroup,
      touchesHub,
    })
    const cosmicDepthAlpha = isCosmicPalette ? 0.26 + cosmicLinkNearDepth * 0.66 : 1
    linkColors[i * 4 + 3] = isAnalystPalette && touchesCenter
      ? 0
      : predictedEdge
      ? Math.max(baseAlpha, 0.28 + edgeConfidence * 0.32) * (isAnalystPalette ? 0.88 + analystOverview * 0.12 : 1)
      : projectedEdge
        ? Math.max(baseAlpha * 0.46, 0.08 + Math.min(0.22, edgeConfidence * 0.24)) * (isAnalystPalette ? 0.72 + analystOverview * 0.14 : 1)
        : baseAlpha * cosmicDepthAlpha * analystMacroEdgeWeight
    const rawLinkWidth = edgeRawWidthForContext(context, {
      aDegree,
      analystFocusEdge,
      bDegree,
      cosmicLinkNearDepth,
      edgeConfidence,
      edgeWeight,
      predictedEdge,
      projectedEdge,
      sameGroup,
      touchesCenter,
      touchesHub,
    })
    linkWidths[i] = rawLinkWidth * (isAnalystPalette && touchesHub ? 1 - analystOverview * 0.34 : 1)
  }
}
