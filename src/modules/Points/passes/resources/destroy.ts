import { destroyResource } from '@/graph/modules/Points/passes/resources/lifecycle'
import { destroyVisiblePointCullState } from '@/graph/modules/Points/passes/visible-culling/prepare'

export function destroyPointResources (points: any): void {
  // 1. Destroy Models FIRST (they destroy _gpuGeometry if exists, and _uniformStore)
  points.drawCommand = destroyResource(points.drawCommand)
  points.drawCulledCommand = destroyResource(points.drawCulledCommand)
  points.densityImpostorCommand = destroyResource(points.densityImpostorCommand)
  points.densityCompositeCommand = destroyResource(points.densityCompositeCommand)
  points.tileImpostorCommand = destroyResource(points.tileImpostorCommand)
  points.hybridAnchorCommand = destroyResource(points.hybridAnchorCommand)
  points.compactedAnchorCommand = destroyResource(points.compactedAnchorCommand)
  points.drawHighlightedCommand = destroyResource(points.drawHighlightedCommand)
  points.updatePositionCommand = destroyResource(points.updatePositionCommand)
  points.updatePositionComputePipeline = destroyResource(points.updatePositionComputePipeline)
  points.updatePositionComputeShader = destroyResource(points.updatePositionComputeShader)
  points.dragPointCommand = destroyResource(points.dragPointCommand)
  points.dragPointComputePipeline = destroyResource(points.dragPointComputePipeline)
  points.dragPointComputeShader = destroyResource(points.dragPointComputeShader)
  points.clearTileImpostorPipeline = destroyResource(points.clearTileImpostorPipeline)
  points.clearTileImpostorShader = destroyResource(points.clearTileImpostorShader)
  points.binTileImpostorPipeline = destroyResource(points.binTileImpostorPipeline)
  points.binTileImpostorShader = destroyResource(points.binTileImpostorShader)
  points.resolveTileImpostorPipeline = destroyResource(points.resolveTileImpostorPipeline)
  points.resolveTileImpostorShader = destroyResource(points.resolveTileImpostorShader)
  points.clearHybridAnchorPipeline = destroyResource(points.clearHybridAnchorPipeline)
  points.clearHybridAnchorShader = destroyResource(points.clearHybridAnchorShader)
  points.fillHybridAnchorPipeline = destroyResource(points.fillHybridAnchorPipeline)
  points.fillHybridAnchorShader = destroyResource(points.fillHybridAnchorShader)
  points.materializeHybridAnchorPipeline = destroyResource(points.materializeHybridAnchorPipeline)
  points.materializeHybridAnchorShader = destroyResource(points.materializeHybridAnchorShader)
  points.cullVisiblePointsPipeline = destroyResource(points.cullVisiblePointsPipeline)
  points.prefixVisiblePointsPipeline = destroyResource(points.prefixVisiblePointsPipeline)
  points.prefixVisiblePointBlocksPipeline = destroyResource(points.prefixVisiblePointBlocksPipeline)
  points.addVisiblePointBlockOffsetsPipeline = destroyResource(points.addVisiblePointBlockOffsetsPipeline)
  points.clearVisiblePointTileBudgetPipeline = destroyResource(points.clearVisiblePointTileBudgetPipeline)
  points.selectVisiblePointTileBudgetPipeline = destroyResource(points.selectVisiblePointTileBudgetPipeline)
  points.scatterVisiblePointsPipeline = destroyResource(points.scatterVisiblePointsPipeline)
  points.cullVisiblePointsShader = destroyResource(points.cullVisiblePointsShader)
  points.prefixVisiblePointsShader = destroyResource(points.prefixVisiblePointsShader)
  points.clearVisiblePointTileBudgetShader = destroyResource(points.clearVisiblePointTileBudgetShader)
  points.findPointsInRectCommand = destroyResource(points.findPointsInRectCommand)
  points.findPointsInPolygonCommand = destroyResource(points.findPointsInPolygonCommand)
  points.findHoveredPointCommand = destroyResource(points.findHoveredPointCommand)
  points.fillSampledPointsFboCommand = destroyResource(points.fillSampledPointsFboCommand)
  points.trackPointsCommand = destroyResource(points.trackPointsCommand)
  points.drawBindingsBackend = undefined
  points.drawBindingsPosition = undefined
  points.drawBindingsPreviousPosition = undefined
  points.drawBindingsPointStatus = undefined
  points.drawBindingsPointStatusBuffer = undefined
  points.drawBindingsImageAtlas = undefined
  points.drawBindingsImageAtlasCoords = undefined

  // 2. Destroy Framebuffers (before textures they reference)
  points.currentPositionFbo = destroyResource(points.currentPositionFbo)
  points.previousPositionFbo = destroyResource(points.previousPositionFbo)
  points.velocityFbo = destroyResource(points.velocityFbo)
  points.searchFbo = destroyResource(points.searchFbo)
  points.hoveredFbo = destroyResource(points.hoveredFbo)
  points.trackedPositionsFbo = destroyResource(points.trackedPositionsFbo)
  points.sampledPointsFbo = destroyResource(points.sampledPointsFbo)
  points.densityImpostorFbo = destroyResource(points.densityImpostorFbo)

  // 3. Destroy Textures
  points.currentPositionTexture = destroyResource(points.currentPositionTexture)
  points.previousPositionTexture = destroyResource(points.previousPositionTexture)
  points.velocityTexture = destroyResource(points.velocityTexture)
  points.searchTexture = destroyResource(points.searchTexture)
  points.hoveredTexture = destroyResource(points.hoveredTexture)
  points.pointStatusTexture = destroyResource(points.pointStatusTexture)
  points.sizeTexture = destroyResource(points.sizeTexture)
  points.trackedIndicesTexture = destroyResource(points.trackedIndicesTexture)
  points.polygonPathTexture = destroyResource(points.polygonPathTexture)
  points.imageAtlasTexture = destroyResource(points.imageAtlasTexture)
  points.imageAtlasCoordsTexture = destroyResource(points.imageAtlasCoordsTexture)
  points.pinnedStatusTexture = destroyResource(points.pinnedStatusTexture)
  points.densityImpostorTexture = destroyResource(points.densityImpostorTexture)
  points.densityImpostorSize = undefined

  // 4. Destroy UniformStores (Models already destroyed their managed uniform buffers)
  points.updatePositionUniformStore = destroyResource(points.updatePositionUniformStore)
  points.updatePositionComputeUniformStore = destroyResource(points.updatePositionComputeUniformStore)
  points.dragPointUniformStore = destroyResource(points.dragPointUniformStore)
  points.dragPointComputeUniformStore = destroyResource(points.dragPointComputeUniformStore)
  points.drawUniformStore = destroyResource(points.drawUniformStore)
  points.densityImpostorUniformStore = destroyResource(points.densityImpostorUniformStore)
  points.densityCompositeUniformStore = destroyResource(points.densityCompositeUniformStore)
  points.tileImpostorUniformStore = destroyResource(points.tileImpostorUniformStore)
  points.tileImpostorUniformBuffer = undefined
  points.tileRenderUniformStore = destroyResource(points.tileRenderUniformStore)
  points.hybridAnchorUniformStore = destroyResource(points.hybridAnchorUniformStore)
  points.hybridAnchorBuildUniformStore = destroyResource(points.hybridAnchorBuildUniformStore)
  points.hybridAnchorBuildUniformBuffer = undefined
  points.compactedAnchorUniformStore = destroyResource(points.compactedAnchorUniformStore)
  points.cullVisiblePointsUniformStore = destroyResource(points.cullVisiblePointsUniformStore)
  points.cullVisiblePointsUniformBuffer = undefined
  points.findPointsInRectUniformStore = destroyResource(points.findPointsInRectUniformStore)
  points.findPointsInPolygonUniformStore = destroyResource(points.findPointsInPolygonUniformStore)
  points.findHoveredPointUniformStore = destroyResource(points.findHoveredPointUniformStore)
  points.fillSampledPointsUniformStore = destroyResource(points.fillSampledPointsUniformStore)
  points.drawHighlightedUniformStore = destroyResource(points.drawHighlightedUniformStore)
  points.trackPointsUniformStore = destroyResource(points.trackPointsUniformStore)

  // 5. Destroy Buffers (passed via attributes - NOT owned by Models, must destroy manually)
  points.colorBuffer = destroyResource(points.colorBuffer)
  points.sizeBuffer = destroyResource(points.sizeBuffer)
  points.shapeBuffer = destroyResource(points.shapeBuffer)
  points.imageIndicesBuffer = destroyResource(points.imageIndicesBuffer)
  points.imageSizesBuffer = destroyResource(points.imageSizesBuffer)
  points.drawPointIndices = destroyResource(points.drawPointIndices)
  points.hoveredPointIndices = destroyResource(points.hoveredPointIndices)
  points.sampledPointIndices = destroyResource(points.sampledPointIndices)
  points.tileAtomicBuffer = destroyResource(points.tileAtomicBuffer)
  points.tileResolvedBuffer = destroyResource(points.tileResolvedBuffer)
  points.hybridAnchorCountBuffer = destroyResource(points.hybridAnchorCountBuffer)
  points.hybridAnchorPositionBuffer = destroyResource(points.hybridAnchorPositionBuffer)
  points.hybridAnchorColorBuffer = destroyResource(points.hybridAnchorColorBuffer)
  points.hybridAnchorIndirectBuffer = destroyResource(points.hybridAnchorIndirectBuffer)
  points.setVisiblePointCullState(destroyVisiblePointCullState({
    visiblePointIndexBuffer: points.visiblePointIndexBuffer,
    visiblePointIndirectBuffer: points.visiblePointIndirectBuffer,
    visiblePointGroupOffsetBuffer: points.visiblePointGroupOffsetBuffer,
    visiblePointMaskBuffer: points.visiblePointMaskBuffer,
    visiblePointBlockSumBuffer: points.visiblePointBlockSumBuffer,
    visiblePointBlockOffsetBuffer: points.visiblePointBlockOffsetBuffer,
    visiblePointTileBudgetBuffer: points.visiblePointTileBudgetBuffer,
    visiblePointCapacity: points.visiblePointCapacity,
    visiblePointGroupCapacity: points.visiblePointGroupCapacity,
    visiblePointBlockCapacity: points.visiblePointBlockCapacity,
    visiblePointTileBudgetCapacity: points.visiblePointTileBudgetCapacity,
    cullVisiblePointsUniformStore: points.cullVisiblePointsUniformStore,
    cullVisiblePointsUniformBuffer: points.cullVisiblePointsUniformBuffer,
    cullVisiblePointsPipeline: points.cullVisiblePointsPipeline,
    prefixVisiblePointsPipeline: points.prefixVisiblePointsPipeline,
    prefixVisiblePointBlocksPipeline: points.prefixVisiblePointBlocksPipeline,
    addVisiblePointBlockOffsetsPipeline: points.addVisiblePointBlockOffsetsPipeline,
    clearVisiblePointTileBudgetPipeline: points.clearVisiblePointTileBudgetPipeline,
    selectVisiblePointTileBudgetPipeline: points.selectVisiblePointTileBudgetPipeline,
    scatterVisiblePointsPipeline: points.scatterVisiblePointsPipeline,
    cullVisiblePointsShader: points.cullVisiblePointsShader,
    prefixVisiblePointsShader: points.prefixVisiblePointsShader,
    clearVisiblePointTileBudgetShader: points.clearVisiblePointTileBudgetShader,
    isCulledPointDrawPrepared: points.isCulledPointDrawPrepared,
  }))
  points.visiblePointTileBudgetBuffer = destroyResource(points.visiblePointTileBudgetBuffer)
  points.activePointMaskBuffer = destroyResource(points.activePointMaskBuffer)
  points.positionStorageBuffer = destroyResource(points.positionStorageBuffer)
  points.previousRenderPositionStorageBuffer = destroyResource(points.previousRenderPositionStorageBuffer)
  points.positionStorageBufferTextureSize = 0
  points.visiblePointCapacity = 0
  points.visiblePointGroupCapacity = 0
  points.visiblePointBlockCapacity = 0
  points.visiblePointTileBudgetCapacity = 0
  points.activePointMaskCapacity = 0
  points.activePointMaskSignature = ''
  points.activePointMaskPointCount = 0
  points.activePointMaskDirty = true
  points.activePointMaskIndicesRef = undefined
  points.isCulledPointDrawPrepared = false
  points.hybridAnchorCapacity = 0
  points.tileColumns = 0
  points.tileRows = 0
  points.tileCount = 0
  points.updatePositionVertexCoordBuffer = destroyResource(points.updatePositionVertexCoordBuffer)
  points.dragPointVertexCoordBuffer = destroyResource(points.dragPointVertexCoordBuffer)
  points.findPointsInRectVertexCoordBuffer = destroyResource(points.findPointsInRectVertexCoordBuffer)
  points.findPointsInPolygonVertexCoordBuffer = destroyResource(points.findPointsInPolygonVertexCoordBuffer)
  points.drawHighlightedVertexCoordBuffer = destroyResource(points.drawHighlightedVertexCoordBuffer)
  points.trackPointsVertexCoordBuffer = destroyResource(points.trackPointsVertexCoordBuffer)
  points.drawQuadVertexBuffer = destroyResource(points.drawQuadVertexBuffer)
}
