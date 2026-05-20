// Uniforms block must match the visible-pass uniforms struct (see
// draw-curve-line.wgsl). Kept in sync via copy/paste because WGSL has no
// `#include`.
export const drawLineUniformsStructWgsl = `
struct DrawLineUniforms {
  transformationMatrix: mat4x4<f32>,
  pointsTextureSize: f32,
  widthScale: f32,
  linkArrowsSizeScale: f32,
  spaceSize: f32,
  screenSize: vec2<f32>,
  linkVisibilityDistanceRange: vec2<f32>,
  linkVisibilityMinTransparency: f32,
  linkOpacity: f32,
  greyoutOpacity: f32,
  curvedWeight: f32,
  curvedLinkControlPointDistance: f32,
  curvedLinkSegments: f32,
  linkBundlingStrength: f32,
  linkBundlingCellSize: f32,
  scaleLinksOnZoom: f32,
  maxPointSize: f32,
  renderMode: f32,
  hoveredLinkIndex: f32,
  hoveredLinkColor: vec4<f32>,
  hoveredLinkWidthIncrease: f32,
  isLinkHighlightingActive: f32,
  linkStatusTextureSize: f32,
  focusedLinkIndex: f32,
  focusedLinkWidthIncrease: f32,
  linkMinPixelLength: f32,
  linkLodStrength: f32,
  linkLodZoomRange: vec2<f32>,
  linkLodMinSampleRate: f32,
  linkLodWidthCompensation: f32,
  linkLodOpacityCompensation: f32,
  renderPositionMix: f32,
};
`

export const precomputeLineUniformsStructWgsl = `
struct PrecomputeLineUniforms {
  linkCount: u32,
};
`
