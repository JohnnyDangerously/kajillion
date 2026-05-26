import {
  DEFAULT_POINT_LOD_ZOOM_RANGE,
  DISABLED_COLOR_VEC4,
  IDENTITY_MAT4,
  TRANSPARENT_BLACK,
  WHITE_VEC4,
  ZERO_VEC2,
} from '@/graph/modules/Points/passes/shared/constants'
import type {
  DrawHighlightedUniforms,
  PointDrawFragmentUniforms,
  PointDrawVertexUniforms,
} from '@/graph/modules/Points/passes/draw/contracts'

export function createPointDrawVertexUniformScratch (): PointDrawVertexUniforms {
  return {
    ratio: 1,
    transformationMatrix: IDENTITY_MAT4,
    pointsTextureSize: 0,
    sizeScale: 1,
    spaceSize: 0,
    screenSize: ZERO_VEC2,
    greyoutColor: DISABLED_COLOR_VEC4,
    backgroundColor: TRANSPARENT_BLACK,
    scalePointsOnZoom: 0,
    maxPointSize: 0,
    isDarkenGreyout: 0,
    skipHighlighted: 0,
    skipGreyed: 0,
    hasImages: 0,
    imageCount: 0,
    imageAtlasCoordsTextureSize: 0,
    pointMinPixelSize: 0,
    pointLodStrength: 0,
    pointLodZoomRange: DEFAULT_POINT_LOD_ZOOM_RANGE,
    pointLodMinSampleRate: 1,
    pointLodSizeCompensation: 1,
    pointLodOpacityCompensation: 1,
    renderPositionMix: 1,
    pointDepthCueStrength: 0,
    pointDepthCueSize: 0.08,
    pointDepthCueBrightness: 0.12,
    pointDepthCueOpacity: 0.14,
    pointDepthCueMoat: 0.16,
    pointDepthCueHighlight: 0.18,
    pointDepthCueShadow: 0.18,
    pointDepthCueSaturation: 0.12,
    pointBorderTreatment: 1,
  }
}

export function createPointDrawFragmentUniformScratch (): PointDrawFragmentUniforms {
  return {
    greyoutOpacity: -1,
    pointOpacity: 1,
    isDarkenGreyout: 0,
    backgroundColor: TRANSPARENT_BLACK,
    outlineColor: WHITE_VEC4,
    outlineWidth: 0.9,
    hasNonCircleShapes: 0,
    hasOutlinedPoints: 0,
    hasImagedPoints: 0,
  }
}

export function createDrawHighlightedUniformPayload (): DrawHighlightedUniforms {
  return {
    drawHighlightedUniforms: {
      color: WHITE_VEC4,
      width: 0.85,
      pointIndex: 0,
      size: 1,
      sizeScale: 1,
      pointsTextureSize: 0,
      transformationMatrix: IDENTITY_MAT4,
      spaceSize: 0,
      screenSize: ZERO_VEC2,
      scalePointsOnZoom: 0,
      maxPointSize: 0,
      universalPointOpacity: 1,
      greyoutOpacity: -1,
      isDarkenGreyout: 0,
      backgroundColor: TRANSPARENT_BLACK,
      greyoutColor: TRANSPARENT_BLACK,
    },
  }
}
