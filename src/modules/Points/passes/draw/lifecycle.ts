import type { Buffer, Texture } from '@luma.gl/core'
import type { GraphConfigInterface } from '@/graph/config'
import type { GraphData } from '@/graph/modules/GraphData'
import type { PointDrawVertexUniforms } from '@/graph/modules/Points/passes/draw/contracts'
import type { PointDrawBackend, PointDrawLayer } from '@/graph/modules/Points/passes/draw/types'

export {
  createDrawHighlightedUniformPayload,
  createPointDrawFragmentUniformScratch,
  createPointDrawVertexUniformScratch,
} from '@/graph/modules/Points/passes/draw/uniform-scratch'

export type { PointDrawBackend, PointDrawLayer } from '@/graph/modules/Points/passes/draw/types'

export {
  fillDrawHighlightedUniformPayload,
  fillPointDrawUniforms,
} from '@/graph/modules/Points/passes/draw/uniform-fillers'

export function getPointDrawBackend (deviceType: string | undefined): PointDrawBackend {
  return deviceType === 'webgpu' ? 'webgpu' : 'webgl'
}

export function hasPointDrawHighlighting (config: GraphConfigInterface): boolean {
  return config.highlightedPointIndices !== undefined
}

export function setPointDrawLayerFlags (
  drawVertexUniforms: PointDrawVertexUniforms,
  layer: PointDrawLayer
): void {
  if (layer === 'greyed') {
    drawVertexUniforms.skipHighlighted = 1
    drawVertexUniforms.skipGreyed = 0
    return
  }
  if (layer === 'highlighted') {
    drawVertexUniforms.skipHighlighted = 0
    drawVertexUniforms.skipGreyed = 1
    return
  }
  drawVertexUniforms.skipHighlighted = 0
  drawVertexUniforms.skipGreyed = 0
}

export function shouldRefreshPointDrawBindings (
  cachedBackend: string | undefined,
  cachedPosition: Buffer | Texture | undefined,
  cachedPreviousPosition: Buffer | undefined,
  cachedPointStatus: Texture | undefined,
  cachedPointStatusBuffer: Buffer | undefined,
  cachedImageAtlas: Texture | undefined,
  cachedImageAtlasCoords: Texture | undefined,
  backend: PointDrawBackend,
  position: Buffer | Texture,
  previousPosition: Buffer | undefined,
  pointStatusTexture: Texture,
  pointStatusBuffer: Buffer | undefined,
  imageAtlasTexture: Texture,
  imageAtlasCoordsTexture: Texture
): boolean {
  return (
    cachedBackend !== backend ||
    cachedPosition !== position ||
    cachedPreviousPosition !== previousPosition ||
    cachedPointStatus !== pointStatusTexture ||
    cachedPointStatusBuffer !== pointStatusBuffer ||
    cachedImageAtlas !== imageAtlasTexture ||
    cachedImageAtlasCoords !== imageAtlasCoordsTexture
  )
}

export function getEstimatedPointPixelSize (
  config: GraphConfigInterface,
  effectivePixelRatio: number,
  scale: number
): number {
  const unscaledSize = config.pointDefaultSize * config.pointSizeScale * effectivePixelRatio
  return config.scalePointsOnZoom ? unscaledSize * scale : unscaledSize
}

export function shouldPrepareCulledPointDraw (
  forcePolicy: boolean,
  hasActiveFilter: boolean,
  scale: number,
  pointLodStrength: number,
  pointLodRange: [number, number],
  estimatedPointPixelSize: number,
  pointMinPixelSize: number,
  pointTileBudgetActive: boolean
): boolean {
  if (forcePolicy || hasActiveFilter || pointTileBudgetActive) return true
  const pointLodNearScale = Math.max(pointLodRange[0], pointLodRange[1])
  if (pointLodStrength > 0 && scale < pointLodNearScale) return true
  if (pointMinPixelSize > 0 && estimatedPointPixelSize < pointMinPixelSize * 1.35) return true
  return scale >= 1.85
}

export function getPointVisualRingSize (
  data: GraphData,
  pointIndex: number
): number {
  const pointSize = data.pointSizes?.[pointIndex] ?? 1
  const imageSize = data.pointImageSizes?.[pointIndex] ?? pointSize
  return Math.max(pointSize, imageSize)
}
