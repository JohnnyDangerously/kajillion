import { isWorkMode } from '../../work-mode'
import { DEMO_SPACE_SIZE } from '../../demo-lifecycle/demo-space'
import type { WorkGraphData } from '../../demo-lifecycle/work-graph-types'
import type { RenderableGraphData } from '../../../graph-contract'
import { isGalleryPalette } from '../../../gallery-presets'
import { analystZoomEqualization, smooth01 } from './analyst-sizing'
import { graphDegrees } from './graph-degrees'
import type { VisualAttributeContext, VisualAttributeData, VisualAttributeOptions } from './types'

export function buildVisualAttributeContext (
  data: VisualAttributeData,
  options: VisualAttributeOptions
): VisualAttributeContext {
  const { config, spaceSize = DEMO_SPACE_SIZE } = options
  const isLight = config.theme === 'light'
  const isDense = config.density
  const isWork = isWorkMode(config)
  const useGalleryPalette = (isGalleryPalette(config.palette) && !isLight) ||
    ((config.palette === 'subnet' || config.palette === 'analyst') && isLight)
  const isTokyoPalette = config.palette === 'tokyo' && useGalleryPalette
  const isCosmicPalette = config.palette === 'cosmic' && useGalleryPalette
  const isSubnetPalette = config.palette === 'subnet' && useGalleryPalette
  const isAnalystPalette = config.palette === 'analyst' && useGalleryPalette
  const isFintechPalette = config.palette === 'fintech' && useGalleryPalette
  const isInfluencePalette = config.palette === 'influence' && useGalleryPalette
  const isTalentPalette = config.palette === 'talent' && useGalleryPalette
  const useMassConservingLod = false
  const isRankedWork = !isWork || config.lod
  const useLanes = config.lanes
  const degrees = graphDegrees(data)
  const workData = data as WorkGraphData
  const groupForNode = workData.groupForNode
  const nodeKindForNode = workData.nodeKind
  const nodeScoreForNode = workData.nodeScore
  const edgeKindForEdge = (data as RenderableGraphData).edgeKind
  const edgeWeightForEdge = (data as RenderableGraphData).edgeWeight
  const edgeConfidenceForEdge = (data as RenderableGraphData).edgeConfidence
  const isLargeWork = isWork && data.nodeCount >= 2000
  const isAtlasWork = isWork && data.nodeCount >= 50000
  const cx = spaceSize / 2
  const cy = spaceSize / 2
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  if (useGalleryPalette) {
    for (let i = 0; i < data.nodeCount; i += 1) {
      const x = data.positions[i * 2] ?? cx
      const y = data.positions[i * 2 + 1] ?? cy
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }
  const normalizeX = (x: number): number => useGalleryPalette && maxX > minX ? (x - minX) / (maxX - minX) : 0.5
  const normalizeY = (y: number): number => useGalleryPalette && maxY > minY ? 1 - ((y - minY) / (maxY - minY)) : 0.5
  const analystEqualize = isAnalystPalette ? analystZoomEqualization(options.equalizationZoomDistance) : 0
  const analystOverview = isAnalystPalette ? smooth01((options.overviewZoomDistance - 38) / 52) : 0

  return {
    config,
    isLight,
    isDense,
    isWork,
    useGalleryPalette,
    isTokyoPalette,
    isCosmicPalette,
    isSubnetPalette,
    isAnalystPalette,
    isFintechPalette,
    isInfluencePalette,
    isTalentPalette,
    useMassConservingLod,
    isRankedWork,
    useLanes,
    degrees,
    workData,
    groupForNode,
    nodeKindForNode,
    nodeScoreForNode,
    edgeKindForEdge,
    edgeWeightForEdge,
    edgeConfidenceForEdge,
    isLargeWork,
    isAtlasWork,
    cx,
    cy,
    normalizeX,
    normalizeY,
    analystEqualize,
    analystOverview,
  }
}
