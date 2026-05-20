import type { VariableShaderType } from '@luma.gl/core'
import type { Mat4Array } from '@/graph/modules/Store'

type UniformTypeMap<T extends Record<string, unknown>> = Record<keyof T, VariableShaderType>

export type LineDrawUniforms = {
  transformationMatrix: Mat4Array;
  pointsTextureSize: number;
  widthScale: number;
  linkArrowsSizeScale: number;
  spaceSize: number;
  screenSize: [number, number];
  linkVisibilityDistanceRange: [number, number];
  linkVisibilityMinTransparency: number;
  linkOpacity: number;
  greyoutOpacity: number;
  curvedWeight: number;
  curvedLinkControlPointDistance: number;
  curvedLinkSegments: number;
  linkBundlingStrength: number;
  linkBundlingCellSize: number;
  scaleLinksOnZoom: number;
  maxPointSize: number;
  renderMode: number;
  hoveredLinkIndex: number;
  hoveredLinkColor: [number, number, number, number];
  hoveredLinkWidthIncrease: number;
  isLinkHighlightingActive: number;
  linkStatusTextureSize: number;
  focusedLinkIndex: number;
  focusedLinkWidthIncrease: number;
  linkMinPixelLength: number;
  linkLodStrength: number;
  linkLodZoomRange: [number, number];
  linkLodMinSampleRate: number;
  linkLodWidthCompensation: number;
  linkLodOpacityCompensation: number;
  renderPositionMix: number;
}

export type LineDrawFragmentUniforms = {
  renderMode: number;
  hasArrowedLinks: number;
}

export type LineDrawUniformStoreShape = {
  drawLineUniforms: LineDrawUniforms;
  drawLineFragmentUniforms: LineDrawFragmentUniforms;
}

export const DRAW_LINE_UNIFORM_TYPES: UniformTypeMap<LineDrawUniforms> = {
  transformationMatrix: 'mat4x4<f32>',
  pointsTextureSize: 'f32',
  widthScale: 'f32',
  linkArrowsSizeScale: 'f32',
  spaceSize: 'f32',
  screenSize: 'vec2<f32>',
  linkVisibilityDistanceRange: 'vec2<f32>',
  linkVisibilityMinTransparency: 'f32',
  linkOpacity: 'f32',
  greyoutOpacity: 'f32',
  curvedWeight: 'f32',
  curvedLinkControlPointDistance: 'f32',
  curvedLinkSegments: 'f32',
  linkBundlingStrength: 'f32',
  linkBundlingCellSize: 'f32',
  scaleLinksOnZoom: 'f32',
  maxPointSize: 'f32',
  renderMode: 'f32',
  hoveredLinkIndex: 'f32',
  hoveredLinkColor: 'vec4<f32>',
  hoveredLinkWidthIncrease: 'f32',
  isLinkHighlightingActive: 'f32',
  linkStatusTextureSize: 'f32',
  focusedLinkIndex: 'f32',
  focusedLinkWidthIncrease: 'f32',
  linkMinPixelLength: 'f32',
  linkLodStrength: 'f32',
  linkLodZoomRange: 'vec2<f32>',
  linkLodMinSampleRate: 'f32',
  linkLodWidthCompensation: 'f32',
  linkLodOpacityCompensation: 'f32',
  renderPositionMix: 'f32',
}

export const DRAW_LINE_FRAGMENT_UNIFORM_TYPES: UniformTypeMap<LineDrawFragmentUniforms> = {
  renderMode: 'f32',
  hasArrowedLinks: 'f32',
}
