import { UniformStore } from '@luma.gl/core'

import { ensureVec2 } from '@/graph/modules/Shared/uniform-utils'
import type {
  FillSampledPointsUniforms,
  FindHoveredPointUniforms,
  FindPointsInPolygonUniforms,
  FindPointsInRectUniforms,
} from '@/graph/modules/Points/passes/draw/contracts'

import type { PointSearchSetupOptions } from './contracts'

export function createFindPointsInRectUniformStore (
  options: PointSearchSetupOptions
): UniformStore<FindPointsInRectUniforms> {
  return new UniformStore({
    findPointsInRectUniforms: {
      uniformTypes: {
        sizeScale: 'f32',
        spaceSize: 'f32',
        screenSize: 'vec2<f32>',
        ratio: 'f32',
        transformationMatrix: 'mat4x4<f32>',
        rect0: 'vec2<f32>',
        rect1: 'vec2<f32>',
        scalePointsOnZoom: 'f32',
        maxPointSize: 'f32',
      },
      defaultUniforms: {
        sizeScale: options.config.pointSizeScale,
        spaceSize: options.store.adjustedSpaceSize,
        screenSize: ensureVec2(options.store.screenSize, [0, 0]),
        ratio: options.effectivePixelRatio,
        transformationMatrix: options.store.transformationMatrix4x4,
        rect0: ensureVec2(options.store.searchArea?.[0], [0, 0]),
        rect1: ensureVec2(options.store.searchArea?.[1], [0, 0]),
        scalePointsOnZoom: options.config.scalePointsOnZoom ? 1 : 0,
        maxPointSize: options.store.maxPointSize,
      },
    },
  })
}

export function createFindPointsInPolygonUniformStore (
  options: PointSearchSetupOptions
): UniformStore<FindPointsInPolygonUniforms> {
  return new UniformStore({
    findPointsInPolygonUniforms: {
      uniformTypes: {
        spaceSize: 'f32',
        screenSize: 'vec2<f32>',
        transformationMatrix: 'mat4x4<f32>',
        polygonPathLength: 'f32',
      },
      defaultUniforms: {
        spaceSize: options.store.adjustedSpaceSize,
        screenSize: ensureVec2(options.store.screenSize, [0, 0]),
        transformationMatrix: options.store.transformationMatrix4x4,
        polygonPathLength: options.polygonPathLength,
      },
    },
  })
}

export function createFindHoveredPointUniformStore (
  options: PointSearchSetupOptions
): UniformStore<FindHoveredPointUniforms> {
  return new UniformStore({
    findHoveredPointUniforms: {
      uniformTypes: {
        pointsTextureSize: 'f32',
        sizeScale: 'f32',
        spaceSize: 'f32',
        screenSize: 'vec2<f32>',
        ratio: 'f32',
        transformationMatrix: 'mat4x4<f32>',
        mousePosition: 'vec2<f32>',
        scalePointsOnZoom: 'f32',
        maxPointSize: 'f32',
        skipHighlighted: 'f32',
        skipGreyed: 'f32',
      },
      defaultUniforms: {
        pointsTextureSize: options.pointStatusTextureSize,
        sizeScale: options.config.pointSizeScale,
        spaceSize: options.store.adjustedSpaceSize,
        screenSize: ensureVec2(options.store.screenSize, [0, 0]),
        ratio: options.effectivePixelRatio,
        transformationMatrix: options.store.transformationMatrix4x4,
        mousePosition: ensureVec2(options.store.screenMousePosition, [0, 0]),
        scalePointsOnZoom: options.config.scalePointsOnZoom ? 1 : 0,
        maxPointSize: options.store.maxPointSize,
        skipHighlighted: 0,
        skipGreyed: 0,
      },
    },
  })
}

export function createFillSampledPointsUniformStore (
  options: PointSearchSetupOptions
): UniformStore<FillSampledPointsUniforms> {
  return new UniformStore({
    fillSampledPointsUniforms: {
      uniformTypes: {
        pointsTextureSize: 'f32',
        transformationMatrix: 'mat4x4<f32>',
        spaceSize: 'f32',
        screenSize: 'vec2<f32>',
      },
      defaultUniforms: {
        pointsTextureSize: options.pointStatusTextureSize,
        transformationMatrix: options.store.transformationMatrix4x4,
        spaceSize: options.store.adjustedSpaceSize,
        screenSize: ensureVec2(options.store.screenSize, [0, 0]),
      },
    },
  })
}
