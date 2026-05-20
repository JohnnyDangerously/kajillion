import type { GraphConfigInterface } from '@/graph/config'
import type { Store } from '@/graph/modules/Store'
import { ensureVec2, ensureVec4 } from '@/graph/modules/Shared/uniform-utils'
import {
  DEFAULT_LINK_LOD_ZOOM_RANGE,
  DISABLED_COLOR_VEC4,
  IDENTITY_MAT4,
  ZERO_VEC2,
} from '@/graph/modules/Lines/passes/shared/constants'
import type { LineDrawFragmentUniforms, LineDrawUniforms, LineDrawUniformStoreShape } from './contracts'

export function createDrawLineUniformScratch (): LineDrawUniforms {
  return {
    transformationMatrix: IDENTITY_MAT4,
    pointsTextureSize: 0,
    widthScale: 1,
    linkArrowsSizeScale: 1,
    spaceSize: 0,
    screenSize: ZERO_VEC2,
    linkVisibilityDistanceRange: ZERO_VEC2,
    linkVisibilityMinTransparency: 0,
    linkOpacity: 1,
    greyoutOpacity: 1,
    curvedWeight: 0,
    curvedLinkControlPointDistance: 0,
    curvedLinkSegments: 1,
    linkBundlingStrength: 0,
    linkBundlingCellSize: 0,
    scaleLinksOnZoom: 0,
    maxPointSize: 0,
    renderMode: 0,
    hoveredLinkIndex: -1,
    hoveredLinkColor: DISABLED_COLOR_VEC4,
    hoveredLinkWidthIncrease: 0,
    isLinkHighlightingActive: 0,
    linkStatusTextureSize: 0,
    focusedLinkIndex: -1,
    focusedLinkWidthIncrease: 0,
    linkMinPixelLength: 0,
    linkLodStrength: 0,
    linkLodZoomRange: DEFAULT_LINK_LOD_ZOOM_RANGE,
    linkLodMinSampleRate: 1,
    linkLodWidthCompensation: 1,
    linkLodOpacityCompensation: 1,
    renderPositionMix: 1,
  }
}

export function createDrawLineFragmentUniformScratch (): LineDrawFragmentUniforms {
  return {
    renderMode: 0,
    hasArrowedLinks: 0,
  }
}

export function createDrawLineUniformPayload (
  drawLineUniforms: LineDrawUniforms,
  drawLineFragmentUniforms: LineDrawFragmentUniforms
): LineDrawUniformStoreShape {
  return {
    drawLineUniforms,
    drawLineFragmentUniforms,
  }
}

export type ApplyDrawLineUniformsOptions = {
  config: GraphConfigInterface;
  store: Store;
  renderMode: number;
  linkLodStrength: number;
  hasHighlighting: boolean;
  linkStatusTextureSize: number;
  effectiveLineSegments: number;
  isWebGpu: boolean;
  renderPositionMix: number;
  hasArrowedLinks: boolean;
}

export function applyDrawLineUniforms (
  drawLineUniforms: LineDrawUniforms,
  fragmentUniforms: LineDrawFragmentUniforms,
  options: ApplyDrawLineUniformsOptions
): void {
  const {
    config,
    store,
    renderMode,
    linkLodStrength,
    hasHighlighting,
    linkStatusTextureSize,
    effectiveLineSegments,
    isWebGpu,
    renderPositionMix,
    hasArrowedLinks,
  } = options

  drawLineUniforms.transformationMatrix = store.transformationMatrix4x4
  drawLineUniforms.pointsTextureSize = store.pointsTextureSize
  drawLineUniforms.widthScale = config.linkWidthScale
  drawLineUniforms.linkArrowsSizeScale = config.linkArrowsSizeScale
  drawLineUniforms.spaceSize = store.adjustedSpaceSize
  drawLineUniforms.screenSize = ensureVec2(store.screenSize, ZERO_VEC2)
  drawLineUniforms.linkVisibilityDistanceRange = ensureVec2(config.linkVisibilityDistanceRange, ZERO_VEC2)
  drawLineUniforms.linkVisibilityMinTransparency = config.linkVisibilityMinTransparency
  drawLineUniforms.linkOpacity = config.linkOpacity
  drawLineUniforms.greyoutOpacity = config.linkGreyoutOpacity
  drawLineUniforms.curvedWeight = config.curvedLinkWeight
  drawLineUniforms.curvedLinkControlPointDistance = config.curvedLinkControlPointDistance
  drawLineUniforms.curvedLinkSegments = effectiveLineSegments
  drawLineUniforms.linkBundlingStrength = config.linkBundlingStrength
  drawLineUniforms.linkBundlingCellSize = config.linkBundlingCellSize
  drawLineUniforms.scaleLinksOnZoom = config.scaleLinksOnZoom ? 1 : 0
  drawLineUniforms.maxPointSize = store.maxPointSize
  drawLineUniforms.renderMode = renderMode
  drawLineUniforms.hoveredLinkIndex = store.hoveredLinkIndex ?? -1
  drawLineUniforms.hoveredLinkColor = ensureVec4(store.hoveredLinkColor, DISABLED_COLOR_VEC4)
  drawLineUniforms.hoveredLinkWidthIncrease = config.hoveredLinkWidthIncrease
  drawLineUniforms.isLinkHighlightingActive = hasHighlighting ? 1 : 0
  drawLineUniforms.linkStatusTextureSize = linkStatusTextureSize
  drawLineUniforms.focusedLinkIndex = config.focusedLinkIndex ?? -1
  drawLineUniforms.focusedLinkWidthIncrease = config.focusedLinkWidthIncrease
  drawLineUniforms.linkMinPixelLength = config.linkMinPixelLength
  drawLineUniforms.linkLodStrength = linkLodStrength
  drawLineUniforms.linkLodZoomRange = ensureVec2(config.linkLodZoomRange, DEFAULT_LINK_LOD_ZOOM_RANGE)
  drawLineUniforms.linkLodMinSampleRate = config.linkLodMinSampleRate
  drawLineUniforms.linkLodWidthCompensation = config.linkLodWidthCompensation
  drawLineUniforms.linkLodOpacityCompensation = config.linkLodOpacityCompensation
  drawLineUniforms.renderPositionMix = isWebGpu ? renderPositionMix : 1

  fragmentUniforms.renderMode = renderMode
  fragmentUniforms.hasArrowedLinks = hasArrowedLinks ? 1 : 0
}
