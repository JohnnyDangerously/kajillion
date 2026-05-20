import type { GraphConfigInterface } from '@/graph/config'
import type { Store } from '@/graph/modules/Store'
import { ensureVec2, ensureVec4 } from '@/graph/modules/Shared/uniform-utils'
import {
  DEFAULT_POINT_LOD_ZOOM_RANGE,
  DISABLED_COLOR_VEC4,
  TRANSPARENT_BLACK,
  WHITE_VEC4,
  ZERO_VEC2,
} from '@/graph/modules/Points/passes/shared/constants'
import type {
  DrawHighlightedUniforms,
  PointDrawFragmentUniforms,
  PointDrawVertexUniforms,
} from '@/graph/modules/Points/passes/draw/contracts'
import type { PointDrawBackend } from '@/graph/modules/Points/passes/draw/types'

export function fillPointDrawUniforms (
  drawVertexUniforms: PointDrawVertexUniforms,
  drawFragmentUniforms: PointDrawFragmentUniforms,
  config: GraphConfigInterface,
  store: Store,
  effectivePixelRatio: number,
  imageCount: number,
  imageAtlasCoordsTextureSize: number | undefined,
  pointLodStrength: number,
  renderPositionMix: number,
  backend: PointDrawBackend,
  hasNonCircleShapes: boolean
): void {
  drawVertexUniforms.ratio = effectivePixelRatio
  drawVertexUniforms.transformationMatrix = store.transformationMatrix4x4
  drawVertexUniforms.pointsTextureSize = store.pointsTextureSize ?? 0
  drawVertexUniforms.sizeScale = config.pointSizeScale
  drawVertexUniforms.spaceSize = store.adjustedSpaceSize
  drawVertexUniforms.screenSize = ensureVec2(store.screenSize, ZERO_VEC2)
  drawVertexUniforms.greyoutColor = ensureVec4(store.greyoutPointColor, DISABLED_COLOR_VEC4)
  drawVertexUniforms.backgroundColor = ensureVec4(store.backgroundColor, TRANSPARENT_BLACK)
  drawVertexUniforms.scalePointsOnZoom = config.scalePointsOnZoom ? 1 : 0
  drawVertexUniforms.maxPointSize = store.maxPointSize
  drawVertexUniforms.isDarkenGreyout = (store.isDarkenGreyout ?? false) ? 1 : 0
  drawVertexUniforms.hasImages = imageCount > 0 ? 1 : 0
  drawVertexUniforms.imageCount = imageCount
  drawVertexUniforms.imageAtlasCoordsTextureSize = imageAtlasCoordsTextureSize ?? 0
  drawVertexUniforms.pointMinPixelSize = config.pointMinPixelSize
  drawVertexUniforms.pointLodStrength = pointLodStrength
  drawVertexUniforms.pointLodZoomRange = ensureVec2(config.pointLodZoomRange, DEFAULT_POINT_LOD_ZOOM_RANGE)
  drawVertexUniforms.pointLodMinSampleRate = config.pointLodMinSampleRate
  drawVertexUniforms.pointLodSizeCompensation = config.pointLodSizeCompensation
  drawVertexUniforms.pointLodOpacityCompensation = config.pointLodOpacityCompensation
  drawVertexUniforms.renderPositionMix = backend === 'webgpu' ? renderPositionMix : 1
  drawVertexUniforms.pointDepthCueStrength = config.pointDepthCueStrength
  drawVertexUniforms.pointDepthCueSize = config.pointDepthCueSize
  drawVertexUniforms.pointDepthCueBrightness = config.pointDepthCueBrightness
  drawVertexUniforms.pointDepthCueOpacity = config.pointDepthCueOpacity
  drawVertexUniforms.pointDepthCueMoat = config.pointDepthCueMoat
  drawVertexUniforms.pointDepthCueHighlight = config.pointDepthCueHighlight
  drawVertexUniforms.pointDepthCueShadow = config.pointDepthCueShadow
  drawVertexUniforms.pointDepthCueSaturation = config.pointDepthCueSaturation

  drawFragmentUniforms.greyoutOpacity = config.pointGreyoutOpacity ?? -1
  drawFragmentUniforms.pointOpacity = config.pointOpacity
  drawFragmentUniforms.isDarkenGreyout = drawVertexUniforms.isDarkenGreyout
  drawFragmentUniforms.backgroundColor = ensureVec4(store.backgroundColor, TRANSPARENT_BLACK)
  drawFragmentUniforms.outlineColor = ensureVec4(store.outlinedPointRingColor, WHITE_VEC4)
  drawFragmentUniforms.outlineWidth = 0.9
  drawFragmentUniforms.hasNonCircleShapes = hasNonCircleShapes ? 1 : 0
  drawFragmentUniforms.hasOutlinedPoints = config.outlinedPointIndices !== undefined ? 1 : 0
  drawFragmentUniforms.hasImagedPoints = imageCount > 0 ? 1 : 0
}

export function fillDrawHighlightedUniformPayload (
  payload: DrawHighlightedUniforms,
  config: GraphConfigInterface,
  store: Store,
  pointIndex: number,
  size: number,
  color: number[]
): void {
  const uniforms = payload.drawHighlightedUniforms
  uniforms.size = size
  uniforms.transformationMatrix = store.transformationMatrix4x4
  uniforms.pointsTextureSize = store.pointsTextureSize ?? 0
  uniforms.sizeScale = config.pointSizeScale
  uniforms.spaceSize = store.adjustedSpaceSize
  uniforms.screenSize = ensureVec2(store.screenSize, ZERO_VEC2)
  uniforms.scalePointsOnZoom = config.scalePointsOnZoom ? 1 : 0
  uniforms.pointIndex = pointIndex
  uniforms.maxPointSize = store.maxPointSize
  uniforms.color = ensureVec4(color, TRANSPARENT_BLACK)
  uniforms.universalPointOpacity = config.pointOpacity
  uniforms.greyoutOpacity = config.pointGreyoutOpacity ?? -1
  uniforms.isDarkenGreyout = (store.isDarkenGreyout ?? false) ? 1 : 0
  uniforms.backgroundColor = ensureVec4(store.backgroundColor, TRANSPARENT_BLACK)
  uniforms.greyoutColor = ensureVec4(store.greyoutPointColor, TRANSPARENT_BLACK)
  uniforms.width = 0.85
}
