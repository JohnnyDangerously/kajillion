import { updatePointPositionResources } from '@/graph/modules/Points/passes/positions/update'

type PointsHost = any

export function updatePointPositionState (points: PointsHost): void {
  const { device, store, data, config: { rescalePositions, enableSimulation } } = points

  const { pointsTextureSize } = store
  if (!pointsTextureSize || !data.pointPositions || data.pointsNumber === undefined) return

  let shouldRescale = rescalePositions
  if (rescalePositions === undefined && !enableSimulation) shouldRescale = true
  if (points.shouldSkipRescale) shouldRescale = false

  if (shouldRescale) {
    points.rescaleInitialNodePositions()
  } else if (!points.shouldSkipRescale) {
    points.scaleX = undefined
    points.scaleY = undefined
  }

  points.shouldSkipRescale = undefined

  const positionResourceState = updatePointPositionResources({
    device,
    pointPositions: data.pointPositions,
    pointsNumber: data.pointsNumber,
    pointsTextureSize,
    enableSimulation: points.config.enableSimulation,
    drawCommand: points.drawCommand,
    fillSampledPointsFboCommand: points.fillSampledPointsFboCommand,
    state: {
      currentPositionTexture: points.currentPositionTexture,
      currentPositionFbo: points.currentPositionFbo,
      previousPositionTexture: points.previousPositionTexture,
      previousPositionFbo: points.previousPositionFbo,
      velocityTexture: points.velocityTexture,
      velocityFbo: points.velocityFbo,
      searchTexture: points.searchTexture,
      searchFbo: points.searchFbo,
      hoveredTexture: points.hoveredTexture,
      hoveredFbo: points.hoveredFbo,
      positionStorageBuffer: points.positionStorageBuffer,
      previousRenderPositionStorageBuffer: points.previousRenderPositionStorageBuffer,
      positionStorageBufferTextureSize: points.positionStorageBufferTextureSize,
      drawPointIndices: points.drawPointIndices,
      hoveredPointIndices: points.hoveredPointIndices,
      sampledPointIndices: points.sampledPointIndices,
      isPositionStorageBufferDirty: points.isPositionStorageBufferDirty,
    },
  })
  points.currentPositionTexture = positionResourceState.currentPositionTexture
  points.currentPositionFbo = positionResourceState.currentPositionFbo
  points.previousPositionTexture = positionResourceState.previousPositionTexture
  points.previousPositionFbo = positionResourceState.previousPositionFbo
  points.velocityTexture = positionResourceState.velocityTexture
  points.velocityFbo = positionResourceState.velocityFbo
  points.searchTexture = positionResourceState.searchTexture
  points.searchFbo = positionResourceState.searchFbo
  points.hoveredTexture = positionResourceState.hoveredTexture
  points.hoveredFbo = positionResourceState.hoveredFbo
  points.positionStorageBuffer = positionResourceState.positionStorageBuffer
  points.previousRenderPositionStorageBuffer = positionResourceState.previousRenderPositionStorageBuffer
  points.positionStorageBufferTextureSize = positionResourceState.positionStorageBufferTextureSize
  points.drawPointIndices = positionResourceState.drawPointIndices
  points.hoveredPointIndices = positionResourceState.hoveredPointIndices
  points.sampledPointIndices = positionResourceState.sampledPointIndices
  points.isPositionStorageBufferDirty = positionResourceState.isPositionStorageBufferDirty

  points.updatePointStatus()
  points.updatePinnedStatus()
  points.updateSampledPointsGrid()

  points.trackPointsByIndices()
}
