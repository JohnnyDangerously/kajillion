import { ensureVec2 } from '@/graph/modules/Shared/uniform-utils'

import type {
  FindHoveredPointOptions,
  FindPointsInPolygonOptions,
  FindPointsInRectOptions,
  SampledPointFillOptions,
} from './contracts'

export function runFindPointsInRect (options: FindPointsInRectOptions): boolean {
  const {
    device,
    command,
    uniformStore,
    searchFbo,
    currentPositionTexture,
    sizeTexture,
    config,
    store,
    effectivePixelRatio,
  } = options
  if (!command || !uniformStore || !searchFbo || searchFbo.destroyed) return false
  if (!currentPositionTexture || currentPositionTexture.destroyed) return false
  if (!sizeTexture || sizeTexture.destroyed) return false

  uniformStore.setUniforms({
    findPointsInRectUniforms: {
      spaceSize: store.adjustedSpaceSize,
      screenSize: ensureVec2(store.screenSize, [0, 0]),
      sizeScale: config.pointSizeScale,
      transformationMatrix: store.transformationMatrix4x4,
      ratio: effectivePixelRatio,
      rect0: ensureVec2(store.searchArea?.[0], [0, 0]),
      rect1: ensureVec2(store.searchArea?.[1], [0, 0]),
      scalePointsOnZoom: config.scalePointsOnZoom ? 1 : 0,
      maxPointSize: store.maxPointSize,
    },
  })
  command.setBindings({
    positionsTexture: currentPositionTexture,
    pointSize: sizeTexture,
  })

  const renderPass = device.beginRenderPass({ framebuffer: searchFbo })
  command.draw(renderPass)
  renderPass.end()
  return true
}

export function runFindPointsInPolygon (options: FindPointsInPolygonOptions): boolean {
  const {
    device,
    command,
    uniformStore,
    searchFbo,
    currentPositionTexture,
    polygonPathTexture,
    polygonPathLength,
    store,
  } = options
  if (!command || !uniformStore || !searchFbo || searchFbo.destroyed) return false
  if (!currentPositionTexture || currentPositionTexture.destroyed) return false
  if (!polygonPathTexture || polygonPathTexture.destroyed) return false

  uniformStore.setUniforms({
    findPointsInPolygonUniforms: {
      spaceSize: store.adjustedSpaceSize,
      screenSize: ensureVec2(store.screenSize, [0, 0]),
      transformationMatrix: store.transformationMatrix4x4,
      polygonPathLength,
    },
  })
  command.setBindings({
    positionsTexture: currentPositionTexture,
    polygonPathTexture,
  })

  const renderPass = device.beginRenderPass({ framebuffer: searchFbo })
  command.draw(renderPass)
  renderPass.end()
  return true
}

export function runFindHoveredPoint (options: FindHoveredPointOptions): boolean {
  const {
    device,
    command,
    uniformStore,
    hoveredFbo,
    currentPositionTexture,
    pointStatusTexture,
    hoveredPointIndices,
    sizeBuffer,
    imageSizesBuffer,
    config,
    store,
    pointCount,
    effectivePixelRatio,
  } = options
  if (!hoveredFbo || hoveredFbo.destroyed) return false
  if (!command || !uniformStore) return false
  if (!currentPositionTexture || currentPositionTexture.destroyed) return false
  if (!pointStatusTexture || pointStatusTexture.destroyed) return false

  command.setVertexCount(pointCount)
  command.setAttributes({
    ...(hoveredPointIndices && { pointIndices: hoveredPointIndices }),
    ...(sizeBuffer && { size: sizeBuffer }),
    ...(imageSizesBuffer && { imageSize: imageSizesBuffer }),
  })

  const baseUniforms = {
    ratio: effectivePixelRatio,
    sizeScale: config.pointSizeScale,
    pointsTextureSize: store.pointsTextureSize ?? 0,
    transformationMatrix: store.transformationMatrix4x4,
    spaceSize: store.adjustedSpaceSize,
    screenSize: ensureVec2(store.screenSize, [0, 0]),
    scalePointsOnZoom: config.scalePointsOnZoom ? 1 : 0,
    mousePosition: ensureVec2(store.screenMousePosition, [0, 0]),
    maxPointSize: store.maxPointSize,
  }
  const bindings = {
    positionsTexture: currentPositionTexture,
    pointStatus: pointStatusTexture,
  }
  const renderPass = device.beginRenderPass({
    framebuffer: hoveredFbo,
    clearColor: [0, 0, 0, 0],
  })

  if (config.highlightedPointIndices !== undefined) {
    uniformStore.setUniforms({
      findHoveredPointUniforms: { ...baseUniforms, skipHighlighted: 1, skipGreyed: 0 },
    })
    command.setBindings(bindings)
    command.draw(renderPass)
    uniformStore.setUniforms({
      findHoveredPointUniforms: { ...baseUniforms, skipHighlighted: 0, skipGreyed: 1 },
    })
    command.setBindings(bindings)
    command.draw(renderPass)
  } else {
    uniformStore.setUniforms({
      findHoveredPointUniforms: { ...baseUniforms, skipHighlighted: 0, skipGreyed: 0 },
    })
    command.setBindings(bindings)
    command.draw(renderPass)
  }

  renderPass.end()
  return true
}

export function fillSampledPointsFramebuffer (options: SampledPointFillOptions): boolean {
  const { device, command, uniformStore, sampledPointsFbo, currentPositionTexture, store, pointCount } = options
  if (!sampledPointsFbo || sampledPointsFbo.destroyed) return false
  if (!command || !uniformStore) return false
  if (!currentPositionTexture || currentPositionTexture.destroyed) return false

  command.setVertexCount(pointCount)
  uniformStore.setUniforms({
    fillSampledPointsUniforms: {
      pointsTextureSize: store.pointsTextureSize ?? 0,
      transformationMatrix: store.transformationMatrix4x4,
      spaceSize: store.adjustedSpaceSize,
      screenSize: ensureVec2(store.screenSize, [0, 0]),
    },
  })
  command.setBindings({ positionsTexture: currentPositionTexture })

  const fillPass = device.beginRenderPass({
    framebuffer: sampledPointsFbo,
    clearColor: [0, 0, 0, 0],
  })
  command.draw(fillPass)
  fillPass.end()
  return true
}
