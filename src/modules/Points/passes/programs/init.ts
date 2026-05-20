import {
  ensureDragPointRenderCommand,
  ensureUpdatePositionRenderCommand,
} from '@/graph/modules/Points/passes/position-compute/render'
import {
  ensureHighlightedPointDrawSetup,
  ensurePointDrawSetup,
} from '@/graph/modules/Points/passes/draw/setup'
import { ensurePointSearchSetup } from '@/graph/modules/Points/passes/search/setup'
import { ensureTrackPointsSetup } from '@/graph/modules/Points/passes/tracking/setup'

type PointsHost = any

export function initPointPrograms (points: PointsHost): void {
  const { device, config, store, data } = points
  if (!points.imageAtlasCoordsTexture || !points.imageAtlasTexture) {
    points.createAtlas()
  }
  if (!points.colorBuffer) points.updateColor()
  if (!points.sizeBuffer) points.updateSize()
  if (!points.shapeBuffer) points.updateShape()
  if (!points.imageIndicesBuffer) points.updateImageIndices()
  if (!points.imageSizesBuffer) points.updateImageSizes()
  if (!points.pointStatusTexture) points.updatePointStatus()
  const isWebGPU = device.info?.type === 'webgpu'
  if (config.enableSimulation && isWebGPU) {
    points.initUpdatePositionComputePipeline()
  } else if (config.enableSimulation) {
    const updatePositionState = ensureUpdatePositionRenderCommand({
      device,
      command: points.updatePositionCommand,
      uniformStore: points.updatePositionUniformStore,
      vertexCoordBuffer: points.updatePositionVertexCoordBuffer,
      friction: config.simulationFriction,
      spaceSize: store.adjustedSpaceSize,
    })
    points.updatePositionCommand = updatePositionState.command
    points.updatePositionUniformStore = updatePositionState.uniformStore
    points.updatePositionVertexCoordBuffer = updatePositionState.vertexCoordBuffer
  }

  if (isWebGPU) {
    points.initDragPointComputePipeline()
  } else {
    const dragPointState = ensureDragPointRenderCommand({
      device,
      command: points.dragPointCommand,
      uniformStore: points.dragPointUniformStore,
      vertexCoordBuffer: points.dragPointVertexCoordBuffer,
      mousePosition: store.mousePosition,
      hoveredPointIndex: store.hoveredPoint?.index ?? -1,
    })
    points.dragPointCommand = dragPointState.command
    points.dragPointUniformStore = dragPointState.uniformStore
    points.dragPointVertexCoordBuffer = dragPointState.vertexCoordBuffer
  }

  const drawState = ensurePointDrawSetup({
    device,
    command: points.drawCommand,
    uniformStore: points.drawUniformStore,
    quadVertexBuffer: points.drawQuadVertexBuffer,
    pointIndices: points.drawPointIndices,
    sizeBuffer: points.sizeBuffer,
    colorBuffer: points.colorBuffer,
    shapeBuffer: points.shapeBuffer,
    imageIndicesBuffer: points.imageIndicesBuffer,
    imageSizesBuffer: points.imageSizesBuffer,
    config,
    store,
    data,
    imageCount: points.imageCount,
    imageAtlasCoordsTextureSize: points.imageAtlasCoordsTextureSize,
    effectivePixelRatio: points.effectivePixelRatio,
    pointLodStrength: points.getEffectivePointLodStrength(),
    sampleCount: points.config.msaa,
  })
  points.drawCommand = drawState.command
  points.drawUniformStore = drawState.uniformStore
  points.drawQuadVertexBuffer = drawState.quadVertexBuffer

  const searchState = ensurePointSearchSetup({
    device,
    config,
    store,
    data,
    pointStatusTextureSize: store.pointsTextureSize ?? 0,
    effectivePixelRatio: points.effectivePixelRatio,
    polygonPathLength: points.polygonPathLength,
    findPointsInRectCommand: points.findPointsInRectCommand,
    findPointsInRectUniformStore: points.findPointsInRectUniformStore,
    findPointsInRectVertexCoordBuffer: points.findPointsInRectVertexCoordBuffer,
    findPointsInPolygonCommand: points.findPointsInPolygonCommand,
    findPointsInPolygonUniformStore: points.findPointsInPolygonUniformStore,
    findPointsInPolygonVertexCoordBuffer: points.findPointsInPolygonVertexCoordBuffer,
    findHoveredPointCommand: points.findHoveredPointCommand,
    findHoveredPointUniformStore: points.findHoveredPointUniformStore,
    fillSampledPointsFboCommand: points.fillSampledPointsFboCommand,
    fillSampledPointsUniformStore: points.fillSampledPointsUniformStore,
    hoveredPointIndices: points.hoveredPointIndices,
    sampledPointIndices: points.sampledPointIndices,
    sizeBuffer: points.sizeBuffer,
    imageSizesBuffer: points.imageSizesBuffer,
  })
  points.findPointsInRectCommand = searchState.findPointsInRectCommand
  points.findPointsInRectUniformStore = searchState.findPointsInRectUniformStore
  points.findPointsInRectVertexCoordBuffer = searchState.findPointsInRectVertexCoordBuffer
  points.findPointsInPolygonCommand = searchState.findPointsInPolygonCommand
  points.findPointsInPolygonUniformStore = searchState.findPointsInPolygonUniformStore
  points.findPointsInPolygonVertexCoordBuffer = searchState.findPointsInPolygonVertexCoordBuffer
  points.findHoveredPointCommand = searchState.findHoveredPointCommand
  points.findHoveredPointUniformStore = searchState.findHoveredPointUniformStore
  points.fillSampledPointsFboCommand = searchState.fillSampledPointsFboCommand
  points.fillSampledPointsUniformStore = searchState.fillSampledPointsUniformStore

  const highlightedDrawState = ensureHighlightedPointDrawSetup({
    device,
    command: points.drawHighlightedCommand,
    uniformStore: points.drawHighlightedUniformStore,
    vertexCoordBuffer: points.drawHighlightedVertexCoordBuffer,
    config,
    store,
    sampleCount: points.config.msaa,
  })
  points.drawHighlightedCommand = highlightedDrawState.command
  points.drawHighlightedUniformStore = highlightedDrawState.uniformStore
  points.drawHighlightedVertexCoordBuffer = highlightedDrawState.vertexCoordBuffer

  const trackPointsState = ensureTrackPointsSetup({
    device,
    command: points.trackPointsCommand,
    uniformStore: points.trackPointsUniformStore,
    vertexCoordBuffer: points.trackPointsVertexCoordBuffer,
    pointsTextureSize: store.pointsTextureSize ?? 0,
  })
  points.trackPointsCommand = trackPointsState.command
  points.trackPointsUniformStore = trackPointsState.uniformStore
  points.trackPointsVertexCoordBuffer = trackPointsState.vertexCoordBuffer
}
