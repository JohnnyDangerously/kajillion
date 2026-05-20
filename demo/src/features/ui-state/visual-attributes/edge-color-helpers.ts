import {
  displayPaletteColor,
  galleryLinkColor,
  galleryParticleColor,
} from '../../../gallery-presets'
import {
  analystWorkColor,
  fintechColor,
  influenceColor,
  talentColor,
} from './colors'
import type { VisualAttributeContext } from './types'

export type EdgeColor = [number, number, number]

export function edgeMixForContext (context: VisualAttributeContext): number {
  const { isAnalystPalette, isLight, isSubnetPalette, isWork, useMassConservingLod } = context
  return isAnalystPalette ? 0.28 : isSubnetPalette ? 0.92 : useMassConservingLod ? 0.86 : isLight && !isWork ? 0.74 : 0.42
}

export function edgeBaseColorForContext (context: VisualAttributeContext): EdgeColor {
  const { config, isAnalystPalette, isLight, isWork, useMassConservingLod } = context
  return useMassConservingLod
    ? [0.36, 0.40, 0.50]
    : isAnalystPalette
      ? [0.08, 0.09, 0.10]
      : isLight && !isWork
      ? config.palette === 'subnet' ? [0.96, 0.96, 0.96] : [0.44, 0.48, 0.58]
      : config.palette === 'cosmic' ? [0.12, 0.13, 0.22] : config.palette === 'ember' ? [0.58, 0.48, 0.36] : config.palette === 'ion' ? [0.18, 0.28, 0.50] : config.palette === 'signal' ? [0.86, 0.84, 0.78] : config.palette === 'tokyo' ? [0.74, 0.74, 0.72] : config.palette === 'insight' ? [0.23, 0.23, 0.23] : config.palette === 'fintech' ? [0.10, 0.42, 0.58] : config.palette === 'influence' ? [0.42, 0.30, 0.22] : config.palette === 'talent' ? [0.28, 0.55, 0.68] : [0.70, 0.74, 0.82]
}

export function edgeEndpointParticle (
  context: VisualAttributeContext,
  nodeIndex: number,
  group: number,
  degree: number,
  x: number,
  y: number
): EdgeColor | undefined {
  const {
    config,
    groupForNode,
    isAnalystPalette,
    isFintechPalette,
    isInfluencePalette,
    isSubnetPalette,
    isTalentPalette,
    nodeKindForNode,
    nodeScoreForNode,
    normalizeX,
    normalizeY,
    useGalleryPalette,
  } = context
  if (!useGalleryPalette) return undefined
  const nodeGroup = groupForNode ? Math.max(0, groupForNode[nodeIndex] ?? 0) : group
  if (isInfluencePalette && groupForNode) return influenceColor(nodeGroup)
  if (isTalentPalette && groupForNode) return talentColor(nodeGroup)
  if (isFintechPalette && groupForNode) return fintechColor(nodeGroup)
  if (isAnalystPalette) return analystWorkColor(nodeGroup, nodeKindForNode?.[nodeIndex], degree, nodeScoreForNode?.[nodeIndex] ?? 0, (Math.imul(nodeIndex + 1, 2654435761) >>> 0) / 0x1_0000_0000)
  if (isSubnetPalette) return displayPaletteColor(nodeGroup, true)
  return galleryParticleColor(config.palette, normalizeX(x), normalizeY(y), (Math.imul(nodeIndex + 1, 2654435761) >>> 0) / 0x1_0000_0000, degree)
}

export function edgeResolvedColor (
  context: VisualAttributeContext,
  options: {
    group: number;
    normalizedSourceY: number;
    normalizedTargetY: number;
    predictedEdge: boolean;
    projectedEdge: boolean;
    sourceParticle?: EdgeColor;
    targetParticle?: EdgeColor;
  }
): EdgeColor {
  const { config, isLight, useGalleryPalette } = context
  const { group, normalizedSourceY, normalizedTargetY, predictedEdge, projectedEdge, sourceParticle, targetParticle } = options
  return predictedEdge
    ? [1.0, 0.43, 0.10]
    : projectedEdge
      ? [0.42, 0.84, 1.0]
      : useGalleryPalette && sourceParticle && targetParticle
        ? galleryLinkColor(
          config.palette,
          normalizedSourceY,
          normalizedTargetY,
          sourceParticle,
          targetParticle
        )
        : displayPaletteColor(group, isLight)
}

export function edgeColorScalesForContext (context: VisualAttributeContext): EdgeColor {
  const { config, isAnalystPalette, isCosmicPalette, isFintechPalette, isInfluencePalette, isLight, isSubnetPalette, isTalentPalette, isWork, useMassConservingLod } = context
  return [
    isAnalystPalette ? 1.0 : isSubnetPalette ? 1.0 : isLight ? (isWork ? 0.78 : useMassConservingLod ? 0.72 : 0.46) : isCosmicPalette ? 1.16 : config.palette === 'ember' ? 0.86 : config.palette === 'ion' ? 0.74 : config.palette === 'signal' ? 1.05 : config.palette === 'tokyo' ? 1.08 : config.palette === 'insight' ? 1.04 : isFintechPalette ? 1.05 : isInfluencePalette ? 1.12 : isTalentPalette ? 0 : isWork ? 0.72 : 0.40,
    isAnalystPalette ? 1.0 : isSubnetPalette ? 1.0 : isLight ? (isWork ? 0.78 : useMassConservingLod ? 0.72 : 0.46) : isCosmicPalette ? 1.06 : config.palette === 'ember' ? 0.76 : config.palette === 'ion' ? 0.76 : config.palette === 'signal' ? 1.02 : config.palette === 'tokyo' ? 1.04 : config.palette === 'insight' ? 1.04 : isFintechPalette ? 1.05 : isInfluencePalette ? 0.92 : isTalentPalette ? 0 : isWork ? 0.72 : 0.40,
    isAnalystPalette ? 1.0 : isSubnetPalette ? 1.0 : isLight ? (isWork ? 0.84 : useMassConservingLod ? 0.76 : 0.54) : isCosmicPalette ? 0.92 : config.palette === 'ember' ? 0.62 : config.palette === 'ion' ? 0.92 : config.palette === 'signal' ? 0.96 : config.palette === 'tokyo' ? 1.0 : config.palette === 'insight' ? 1.04 : isFintechPalette ? 1.05 : isInfluencePalette ? 0.80 : isTalentPalette ? 0 : isWork ? 0.76 : 0.42,
  ]
}
