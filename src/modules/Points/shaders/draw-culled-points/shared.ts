export const drawCulledPointsSharedWgsl = `
struct DrawVertexUniforms {
  ratio: f32,
  transformationMatrix: mat4x4<f32>,
  pointsTextureSize: f32,
  sizeScale: f32,
  spaceSize: f32,
  screenSize: vec2<f32>,
  greyoutColor: vec4<f32>,
  backgroundColor: vec4<f32>,
  scalePointsOnZoom: f32,
  maxPointSize: f32,
  isDarkenGreyout: f32,
  skipHighlighted: f32,
  skipGreyed: f32,
  hasImages: f32,
  imageCount: f32,
  imageAtlasCoordsTextureSize: f32,
  pointMinPixelSize: f32,
  pointLodStrength: f32,
  pointLodZoomRange: vec2<f32>,
  pointLodMinSampleRate: f32,
  pointLodSizeCompensation: f32,
  pointLodOpacityCompensation: f32,
  renderPositionMix: f32,
  pointDepthCueStrength: f32,
  pointDepthCueSize: f32,
  pointDepthCueBrightness: f32,
  pointDepthCueOpacity: f32,
  pointDepthCueMoat: f32,
  pointDepthCueHighlight: f32,
  pointDepthCueShadow: f32,
  pointDepthCueSaturation: f32,
};

struct DrawFragmentUniforms {
  greyoutOpacity: f32,
  pointOpacity: f32,
  isDarkenGreyout: f32,
  backgroundColor: vec4<f32>,
  outlineColor: vec4<f32>,
  outlineWidth: f32,
  hasNonCircleShapes: f32,
  hasOutlinedPoints: f32,
  hasImagedPoints: f32,
};

@group(0) @binding(0) var<uniform> drawVertex: DrawVertexUniforms;
@group(0) @binding(1) var<uniform> drawFragment: DrawFragmentUniforms;
@group(0) @binding(2) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> pointStatusBuf: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> colors: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> sizes: array<f32>;
@group(0) @binding(6) var<storage, read> visibleIndices: array<u32>;
@group(0) @binding(7) var<storage, read> previousPositions: array<vec4<f32>>;

struct VertexInput {
  @location(0) quadCorner: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) shapeColor: vec4<f32>,
  @location(1) pointCoord: vec2<f32>,
  @location(2) isGreyedOut: f32,
  @location(3) isOutlined: f32,
  @location(4) lodAlpha: f32,
  @location(5) visualDepth: f32,
};

const outlineRingScale: f32 = 1.3;

fn calculatePointSize(pointSize: f32) -> f32 {
  let scale = drawVertex.transformationMatrix[0][0];
  var pSize: f32;
  if (drawVertex.scalePointsOnZoom > 0.0) {
    pSize = pointSize * drawVertex.ratio * scale;
  } else {
    pSize = pointSize * drawVertex.ratio;
  }
  return min(pSize, drawVertex.maxPointSize * drawVertex.ratio);
}

fn hash01(index: u32) -> f32 {
  var x = index + 1u;
  x = (x ^ (x >> 16u)) * 0x7feb352du;
  x = (x ^ (x >> 15u)) * 0x846ca68bu;
  x = x ^ (x >> 16u);
  return f32(x & 0x00ffffffu) / 16777216.0;
}

fn pointLodWeight(scale: f32) -> f32 {
  let farScale = min(drawVertex.pointLodZoomRange.x, drawVertex.pointLodZoomRange.y);
  let nearScale = max(drawVertex.pointLodZoomRange.x, drawVertex.pointLodZoomRange.y);
  let overview = 1.0 - smoothstep(farScale, nearScale, scale);
  return clamp(drawVertex.pointLodStrength, 0.0, 1.0) * overview;
}

fn visualDepth01(index: u32, centerClip: vec2<f32>, pointSize: f32) -> f32 {
  let stableNoise = hash01(index);
  let verticalDepth = centerClip.y * 0.5 + 0.5;
  let sizeDepth = clamp(pointSize / max(drawVertex.maxPointSize * drawVertex.ratio, 1.0), 0.0, 1.0);
  return clamp(0.50 + (stableNoise - 0.5) * 0.50 + (verticalDepth - 0.5) * 0.18 + (sizeDepth - 0.5) * 0.18, 0.0, 1.0);
}

fn applyDepthToColor(color: vec4<f32>, z: f32) -> vec4<f32> {
  let strength = clamp(drawVertex.pointDepthCueStrength, 0.0, 1.0);
  if (strength <= 0.0) {
    return color;
  }
  let brightness = 1.0 + (z - 0.5) * 2.0 * drawVertex.pointDepthCueBrightness * strength;
  let opacity = 1.0 + (z - 0.5) * 2.0 * drawVertex.pointDepthCueOpacity * strength;
  let luma = dot(color.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  let saturationSpan = clamp(drawVertex.pointDepthCueSaturation, 0.0, 1.0) * strength;
  let saturation = 1.0 + (z - 0.5) * 2.0 * saturationSpan;
  let rgb = mix(vec3<f32>(luma), color.rgb, saturation) * brightness;
  return vec4<f32>(clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.35)), clamp(color.a * opacity, 0.0, 1.0));
}
`
