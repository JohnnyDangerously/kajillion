import { UniformStore } from '@luma.gl/core'
import type { GraphConfigInterface } from '@/graph/config'
import type { Mat4Array, Store } from '@/graph/modules/Store'
import { ensureVec2, ensureVec4 } from '@/graph/modules/Shared/uniform-utils'
import type {
  DrawHighlightedUniforms,
  PointDrawUniforms,
} from '@/graph/modules/Points/passes/draw/contracts'

export type CreatePointDrawUniformStoreOptions = {
  config: GraphConfigInterface;
  store: Store;
  imageCount: number;
  imageAtlasCoordsTextureSize: number | undefined;
  effectivePixelRatio: number;
  pointLodStrength: number;
}

export type CreateDrawHighlightedUniformStoreOptions = {
  config: GraphConfigInterface;
  store: Store;
}

export function createPointDrawUniformStore (
  options: CreatePointDrawUniformStoreOptions
): UniformStore<PointDrawUniforms> {
  const { config, store } = options
  return new UniformStore({
    drawVertexUniforms: {
      uniformTypes: {
        ratio: 'f32',
        transformationMatrix: 'mat4x4<f32>',
        pointsTextureSize: 'f32',
        sizeScale: 'f32',
        spaceSize: 'f32',
        screenSize: 'vec2<f32>',
        greyoutColor: 'vec4<f32>',
        backgroundColor: 'vec4<f32>',
        scalePointsOnZoom: 'f32',
        maxPointSize: 'f32',
        isDarkenGreyout: 'f32',
        skipHighlighted: 'f32',
        skipGreyed: 'f32',
        hasImages: 'f32',
        imageCount: 'f32',
        imageAtlasCoordsTextureSize: 'f32',
        pointMinPixelSize: 'f32',
        pointLodStrength: 'f32',
        pointLodZoomRange: 'vec2<f32>',
        pointLodMinSampleRate: 'f32',
        pointLodSizeCompensation: 'f32',
        pointLodOpacityCompensation: 'f32',
        renderPositionMix: 'f32',
        pointDepthCueStrength: 'f32',
        pointDepthCueSize: 'f32',
        pointDepthCueBrightness: 'f32',
        pointDepthCueOpacity: 'f32',
        pointDepthCueMoat: 'f32',
        pointDepthCueHighlight: 'f32',
        pointDepthCueShadow: 'f32',
        pointDepthCueSaturation: 'f32',
        pointBorderTreatment: 'f32',
      },
      defaultUniforms: {
        ratio: options.effectivePixelRatio,
        transformationMatrix: getInitialTransformationMatrix(store),
        pointsTextureSize: store.pointsTextureSize ?? 0,
        sizeScale: config.pointSizeScale,
        spaceSize: store.adjustedSpaceSize,
        screenSize: ensureVec2(store.screenSize, [0, 0]),
        greyoutColor: ensureVec4(store.greyoutPointColor, [0, 0, 0, 1]),
        backgroundColor: ensureVec4(store.backgroundColor, [0, 0, 0, 1]),
        scalePointsOnZoom: config.scalePointsOnZoom ? 1 : 0,
        maxPointSize: store.maxPointSize,
        isDarkenGreyout: (store.isDarkenGreyout ?? false) ? 1 : 0,
        skipHighlighted: 0,
        skipGreyed: 0,
        hasImages: (options.imageCount > 0) ? 1 : 0,
        imageCount: options.imageCount,
        imageAtlasCoordsTextureSize: options.imageAtlasCoordsTextureSize ?? 0,
        pointMinPixelSize: config.pointMinPixelSize,
        pointLodStrength: options.pointLodStrength,
        pointLodZoomRange: ensureVec2(config.pointLodZoomRange, [0.12, 0.65]),
        pointLodMinSampleRate: config.pointLodMinSampleRate,
        pointLodSizeCompensation: config.pointLodSizeCompensation,
        pointLodOpacityCompensation: config.pointLodOpacityCompensation,
        renderPositionMix: 1,
        pointDepthCueStrength: config.pointDepthCueStrength,
        pointDepthCueSize: config.pointDepthCueSize,
        pointDepthCueBrightness: config.pointDepthCueBrightness,
        pointDepthCueOpacity: config.pointDepthCueOpacity,
        pointDepthCueMoat: config.pointDepthCueMoat,
        pointDepthCueHighlight: config.pointDepthCueHighlight,
        pointDepthCueShadow: config.pointDepthCueShadow,
        pointDepthCueSaturation: config.pointDepthCueSaturation,
        pointBorderTreatment: config.pointBorderTreatment,
      },
    },
    drawFragmentUniforms: {
      uniformTypes: {
        greyoutOpacity: 'f32',
        pointOpacity: 'f32',
        isDarkenGreyout: 'f32',
        backgroundColor: 'vec4<f32>',
        outlineColor: 'vec4<f32>',
        outlineWidth: 'f32',
        hasNonCircleShapes: 'f32',
        hasOutlinedPoints: 'f32',
        hasImagedPoints: 'f32',
      },
      defaultUniforms: {
        greyoutOpacity: config.pointGreyoutOpacity ?? -1,
        pointOpacity: config.pointOpacity,
        isDarkenGreyout: (store.isDarkenGreyout ?? false) ? 1 : 0,
        backgroundColor: ensureVec4(store.backgroundColor, [0, 0, 0, 1]),
        outlineColor: ensureVec4(store.outlinedPointRingColor, [1, 1, 1, 1]),
        outlineWidth: 0.9,
        hasNonCircleShapes: 0,
        hasOutlinedPoints: 0,
        hasImagedPoints: 0,
      },
    },
  })
}

export function createDrawHighlightedUniformStore (
  options: CreateDrawHighlightedUniformStoreOptions
): UniformStore<DrawHighlightedUniforms> {
  const { config, store } = options
  return new UniformStore({
    drawHighlightedUniforms: {
      uniformTypes: {
        size: 'f32',
        transformationMatrix: 'mat4x4<f32>',
        pointsTextureSize: 'f32',
        sizeScale: 'f32',
        spaceSize: 'f32',
        screenSize: 'vec2<f32>',
        scalePointsOnZoom: 'f32',
        pointIndex: 'f32',
        maxPointSize: 'f32',
        color: 'vec4<f32>',
        universalPointOpacity: 'f32',
        greyoutOpacity: 'f32',
        isDarkenGreyout: 'f32',
        backgroundColor: 'vec4<f32>',
        greyoutColor: 'vec4<f32>',
        width: 'f32',
      },
      defaultUniforms: {
        size: 1,
        transformationMatrix: store.transformationMatrix4x4,
        pointsTextureSize: store.pointsTextureSize ?? 0,
        sizeScale: config.pointSizeScale,
        spaceSize: store.adjustedSpaceSize,
        screenSize: ensureVec2(store.screenSize, [0, 0]),
        scalePointsOnZoom: config.scalePointsOnZoom ? 1 : 0,
        pointIndex: -1,
        maxPointSize: store.maxPointSize,
        color: [0, 0, 0, 1],
        universalPointOpacity: config.pointOpacity,
        greyoutOpacity: config.pointGreyoutOpacity ?? -1,
        isDarkenGreyout: (store.isDarkenGreyout ?? false) ? 1 : 0,
        backgroundColor: ensureVec4(store.backgroundColor, [0, 0, 0, 1]),
        greyoutColor: ensureVec4(store.greyoutPointColor, [0, 0, 0, 1]),
        width: 0.85,
      },
    },
  })
}

function getInitialTransformationMatrix (store: Store): Mat4Array {
  const t = store.transform ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]
  return [
    t[0], t[1], t[2], 0,
    t[3], t[4], t[5], 0,
    t[6], t[7], t[8], 0,
    0, 0, 0, 1,
  ]
}
