import {
  updatePointColorBuffer,
  updatePointImageIndexBuffer,
  updatePointImageSizeBuffer,
  updatePointShapeBuffer,
  updatePointSizeAttributes,
} from '@/graph/modules/Points/passes/attributes/lifecycle'
import { createPointImageAtlas } from '@/graph/modules/Points/passes/atlas/lifecycle'
import { updatePointPositionState } from '@/graph/modules/Points/passes/positions/refresh'
import { rescaleInitialPointPositions } from '@/graph/modules/Points/passes/positions/rescale'
import { ensureSampledPointsGridFramebuffer } from '@/graph/modules/Points/passes/sampling/grid'
import { updatePinnedStatusTexture } from '@/graph/modules/Points/passes/status/pinned-status'
import { updatePointStatusState } from '@/graph/modules/Points/passes/status/point-status'

type PointsRuntime = any

function runtime (points: unknown): PointsRuntime {
  return points as PointsRuntime
}

export function updatePointPositions (points: unknown): void {
  updatePointPositionState(runtime(points))
}

export function updatePointColor (points: unknown): void {
  const p = runtime(points)
  const { device, store: { pointsTextureSize }, data } = p
  if (!pointsTextureSize) return

  p.colorBuffer = updatePointColorBuffer(device, data, pointsTextureSize, p.colorBuffer, p.drawCommand)
  p.impostorBuildSignature = ''
}

export function updatePointStatus (points: unknown): void {
  const p = runtime(points)
  const { device, config, data, store: { pointsTextureSize } } = p
  const statusState = updatePointStatusState(device, config, data, pointsTextureSize, {
    pointStatusTexture: p.pointStatusTexture,
    pointStatusStorageBuffer: p.pointStatusStorageBuffer,
  })
  p.pointStatusTexture = statusState.pointStatusTexture
  p.pointStatusStorageBuffer = statusState.pointStatusStorageBuffer
}

export function updatePinnedPointStatus (points: unknown): void {
  const p = runtime(points)
  const { device, store: { pointsTextureSize }, data } = p
  p.pinnedStatusTexture = updatePinnedStatusTexture(device, data, pointsTextureSize, p.pinnedStatusTexture)
}

export function updatePointSize (points: unknown): void {
  const p = runtime(points)
  const { device, store: { pointsTextureSize }, data } = p
  if (!pointsTextureSize || data.pointsNumber === undefined || data.pointSizes === undefined) return

  const sizeAttributes = updatePointSizeAttributes(device, data, pointsTextureSize, {
    sizeBuffer: p.sizeBuffer,
    sizeTexture: p.sizeTexture,
  }, p.drawCommand)
  p.sizeBuffer = sizeAttributes.sizeBuffer
  p.sizeTexture = sizeAttributes.sizeTexture
  p.impostorBuildSignature = ''
}

export function updatePointShape (points: unknown): void {
  const p = runtime(points)
  const { device, data } = p
  const shapeAttributes = updatePointShapeBuffer(device, data, {
    shapeBuffer: p.shapeBuffer,
    hasNonCircleShapes: p.hasNonCircleShapes,
  }, p.drawCommand)
  p.shapeBuffer = shapeAttributes.shapeBuffer
  p.hasNonCircleShapes = shapeAttributes.hasNonCircleShapes
}

export function updatePointImageIndices (points: unknown): void {
  const p = runtime(points)
  const { device, data } = p
  p.imageIndicesBuffer = updatePointImageIndexBuffer(device, data, p.imageIndicesBuffer, p.drawCommand)
}

export function updatePointImageSizes (points: unknown): void {
  const p = runtime(points)
  const { device, data } = p
  p.imageSizesBuffer = updatePointImageSizeBuffer(
    device,
    data,
    p.imageSizesBuffer,
    p.drawCommand,
    p.findHoveredPointCommand
  )
}

export function createPointAtlas (points: unknown): void {
  const p = runtime(points)
  const { device, data, store } = p
  const atlasState = createPointImageAtlas(device, data, store, {
    imageAtlasTexture: p.imageAtlasTexture,
    imageAtlasCoordsTexture: p.imageAtlasCoordsTexture,
    imageCount: p.imageCount,
    imageAtlasCoordsTextureSize: p.imageAtlasCoordsTextureSize ?? 0,
  })
  p.imageAtlasTexture = atlasState.imageAtlasTexture
  p.imageAtlasCoordsTexture = atlasState.imageAtlasCoordsTexture
  p.imageCount = atlasState.imageCount
  p.imageAtlasCoordsTextureSize = atlasState.imageAtlasCoordsTextureSize
}

export function updateSampledPointsGridState (points: unknown): void {
  const p = runtime(points)
  const { store: { screenSize }, config: { pointSamplingDistance }, device } = p
  p.sampledPointsFbo = ensureSampledPointsGridFramebuffer(device, screenSize, pointSamplingDistance, p.sampledPointsFbo)
}

export function rescaleInitialNodePositions (points: unknown): void {
  const p = runtime(points)
  const { config: { spaceSize } } = p
  if (!p.data.pointPositions || !spaceSize) return

  const { scaleX, scaleY } = rescaleInitialPointPositions(p.data.pointPositions, spaceSize)
  p.scaleX = scaleX
  p.scaleY = scaleY
}
