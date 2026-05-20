import { PointShape } from '@kajillion/graph'
import {
  WORK_NODE_COMPANY,
  WORK_NODE_GROUP,
  WORK_NODE_PERSON,
  WORK_NODE_ROOT,
  type WorkNodeKind,
} from '../../demo-lifecycle/work-graph-types'
import {
  displayPaletteColor,
  galleryParticleColor,
} from '../../../gallery-presets'
import { analystTierSize } from './analyst-sizing'
import {
  analystWorkColor,
  fintechColor,
  influenceColor,
  talentColor,
} from './colors'
import type { VisualAttributeContext, VisualAttributeData, VisualAttributes } from './types'

export function applyNodeVisualAttributes (
  data: VisualAttributeData,
  attributes: VisualAttributes,
  context: VisualAttributeContext
): void {
  const {
    analystEqualize,
    config,
    cx,
    cy,
    degrees,
    groupForNode,
    isAnalystPalette,
    isCosmicPalette,
    isDense,
    isFintechPalette,
    isInfluencePalette,
    isLargeWork,
    isLight,
    isRankedWork,
    isSubnetPalette,
    isTalentPalette,
    isTokyoPalette,
    isWork,
    nodeKindForNode,
    nodeScoreForNode,
    normalizeX,
    normalizeY,
    useGalleryPalette,
  } = context
  const { pointColors, pointShapes, pointSizes } = attributes

  for (let i = 0; i < data.nodeCount; i += 1) {
    const x = data.positions[i * 2] ?? cx
    const y = data.positions[i * 2 + 1] ?? cy
    const angle = Math.atan2(y - cy, x - cx)
    const bucket = isWork && groupForNode
      ? Math.max(0, groupForNode[i] ?? 0)
      : Math.floor(((angle + Math.PI) / (Math.PI * 2)) * 8)
    const hash = (Math.imul(i + 1, 2654435761) >>> 0) / 0x1_0000_0000
    const degree = degrees[i] ?? 0
    const nodeKind = nodeKindForNode?.[i] as WorkNodeKind | undefined
    const workScore = nodeScoreForNode?.[i] ?? 0
    const cosmicNearDepth = isCosmicPalette ? Math.max(0, Math.min(1, 1 - normalizeY(y))) : 0.5
    const [r, g, b] = isInfluencePalette && groupForNode
      ? influenceColor(Math.max(0, groupForNode[i] ?? 0))
      : isTalentPalette && groupForNode
        ? talentColor(Math.max(0, groupForNode[i] ?? 0))
        : isFintechPalette && groupForNode
          ? fintechColor(Math.max(0, groupForNode[i] ?? 0))
      : isAnalystPalette
        ? analystWorkColor(bucket, nodeKind, degree, workScore, hash)
        : isSubnetPalette
            ? displayPaletteColor(bucket, true)
            : useGalleryPalette
              ? galleryParticleColor(config.palette, normalizeX(x), normalizeY(y), hash, degree)
              : displayPaletteColor(bucket, isLight)
    const isHub = isWork
      ? nodeKind === WORK_NODE_ROOT || nodeKind === WORK_NODE_GROUP || nodeKind === WORK_NODE_COMPANY || degree >= 16
      : isCosmicPalette ? (degree >= 9 || hash > 0.982) : hash > 0.982
    const isMicroDetail = false
    const lightScale = useGalleryPalette ? 1.0 : isWork ? 1.04 : 1.14
    pointColors[i * 4] = isLight ? Math.min(1, r * lightScale) : r
    pointColors[i * 4 + 1] = isLight ? Math.min(1, g * lightScale) : g
    pointColors[i * 4 + 2] = isLight ? Math.min(1, b * lightScale) : b
    pointColors[i * 4 + 3] = isAnalystPalette
      ? nodeKind === WORK_NODE_ROOT
        ? 0
        : nodeKind === WORK_NODE_PERSON
          ? 0.82
          : 0.96
      : isWork
      ? (isHub ? 1 : (isLight ? 0.82 : 0.90))
          : isSubnetPalette
        ? 0.96
        : isTokyoPalette
          ? (isHub ? 1 : 0.92)
          : isInfluencePalette
            ? (i === 0 || degree > 18 ? 1 : 0.92)
            : isTalentPalette
              ? 0.98
              : isCosmicPalette
                ? (isHub ? 1 : 0.38 + cosmicNearDepth * 0.44)
              : isMicroDetail
                ? (isLight ? 0.16 : 0.20)
                : isHub
                  ? 1
                  : isLight
                    ? (isDense ? 0.64 : 0.48)
                    : (isDense ? 0.84 : 0.48)
    const baseSize = isWork
      ? isRankedWork
        ? nodeKind === WORK_NODE_ROOT
          ? isAnalystPalette ? 0 : (isLargeWork ? 28 : 34)
          : nodeKind === WORK_NODE_GROUP
            ? (isLargeWork ? 18.8 : 23.8) + Math.min(3.8, Math.sqrt(degree) * 0.40)
            : nodeKind === WORK_NODE_COMPANY
              ? (isLargeWork ? 12.4 : 16.8) + hash * 2.0 + Math.min(4.4, Math.sqrt(degree) * 0.78)
              : isAnalystPalette
                ? analystTierSize(nodeKind, degree, workScore, hash, analystEqualize)
                : isSubnetPalette
                ? 8.2 + hash * 1.6 + Math.min(2.2, degree * 0.10)
                : (isLargeWork ? 6.2 : 10.6) + hash * (isLargeWork ? 1.7 : 2.8) + Math.min(isLargeWork ? 1.4 : 2.6, degree * 0.14) + workScore * (isLargeWork ? 1.4 : 2.6)
        : nodeKind === WORK_NODE_ROOT
          ? isAnalystPalette ? 0 : isSubnetPalette ? 22 : 24
          : nodeKind === WORK_NODE_GROUP
            ? isAnalystPalette ? 13.5 : isSubnetPalette ? 16 : 17.2
            : nodeKind === WORK_NODE_COMPANY
              ? isAnalystPalette ? 9.4 : isSubnetPalette ? 11.5 : 12.6
              : isAnalystPalette ? analystTierSize(nodeKind, degree, workScore, hash, analystEqualize) : isSubnetPalette ? 8.8 + hash * 1.1 : (isLargeWork ? 6.7 : 9.8) + hash * 1.4
      : isTokyoPalette
        ? isHub
          ? 3.25 + hash * 1.05
          : 1.78 + hash * 0.64
        : isCosmicPalette
          ? i === 0
            ? 8.2
            : isHub
              ? 3.2 + hash * 2.6
              : 1.02 + hash * 0.68
        : config.palette === 'insight'
          ? isHub
            ? 14 + hash * 5.0
            : 6.2 + hash * 4.6
          : isFintechPalette
            ? isHub || degree > 8
              ? 15 + hash * 4.0
              : 2.8 + hash * 1.8
            : isInfluencePalette
              ? i === 0
                ? 24
                : degree > 32
                  ? 6.5 + hash * 2.0
                  : degree > 12
                    ? 3.2 + hash * 1.3
                    : 1.75 + hash * 0.85
              : isTalentPalette
                ? degree > 4 || hash > 0.80
                  ? 15 + Math.pow(hash, 2.0) * 26
                  : 5.2 + hash * 7.0
                : config.palette === 'signal'
                  ? isHub
                    ? 3.4 + hash * 1.8
                    : 1.55 + hash * 0.78
                  : isHub
                    ? 3.8 + hash * 3.9
                    : 1.18 + hash * 1.18
    const cosmicDepthSize = isCosmicPalette ? 0.70 + cosmicNearDepth * 1.08 + (isHub ? 0.20 : 0) : 1
    pointSizes[i] = baseSize * (isWork ? (isAnalystPalette ? (isDense ? 1.02 : 0.92) : isDense ? 1.16 : 1.0) : (isCosmicPalette || isTokyoPalette || config.palette === 'signal' || config.palette === 'insight' || isFintechPalette || isInfluencePalette || isTalentPalette) ? 1 : isLight ? (isDense ? 1.10 : 0.54) : isDense ? 1 : 0.44) * (isMicroDetail ? 0.45 : 1) * cosmicDepthSize
    if (isAnalystPalette) pointShapes[i] = PointShape.Circle
  }
}
