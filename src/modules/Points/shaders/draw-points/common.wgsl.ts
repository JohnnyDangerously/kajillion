export const drawPointsCommonWgsl = `// WGSL counterpart to draw-points.vert + draw-points.frag.
// One file, both entry points, used when useWebGPU = true.
//
// WebGPU has no gl_PointSize / gl_PointCoord, so each point is rendered as a
// 4-vertex triangle-strip instance. \`quadCorner\` covers [-1,1]^2 and doubles
// as the SDF coordinate the fragment shader needs.

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
  pointBorderTreatment: f32,
};

struct DrawFragmentUniforms {
  greyoutOpacity: f32,
  pointOpacity: f32,
  isDarkenGreyout: f32,
  backgroundColor: vec4<f32>,
  outlineColor: vec4<f32>,
  outlineWidth: f32,
  // Specialization flags — set by the host once per draw based on what the
  // data actually contains. The WGSL compiler dead-strips branches behind
  // these uniform conditions when the flag is constant zero, which avoids
  // running the 8-way shape ladder / image sampling / outline ring math on
  // the common case of plain circles with no decorations.
  hasNonCircleShapes: f32,
  hasOutlinedPoints: f32,
  hasImagedPoints: f32,
};

@group(0) @binding(0) var<uniform> drawVertex: DrawVertexUniforms;
@group(0) @binding(1) var<uniform> drawFragment: DrawFragmentUniforms;
// Vertex-pulling: positions live in a storage buffer indexed by instance.
// Replaces textureSampleLevel(positionsTexture, ...) — that path costs
// ~750ms/frame at n=100k due to vertex-stage texture sampling on Apple TBDR.
@group(0) @binding(2) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(3) var pointStatus: texture_2d<f32>;
@group(0) @binding(4) var pointStatusSampler: sampler;
@group(0) @binding(5) var imageAtlasTexture: texture_2d<f32>;
@group(0) @binding(6) var imageAtlasTextureSampler: sampler;
@group(0) @binding(7) var imageAtlasCoords: texture_2d<f32>;
@group(0) @binding(8) var imageAtlasCoordsSampler: sampler;
// Vertex-pulling: pointStatus (R=greyout, G=outlined) read via storage
// buffer instead of vertex-stage textureSampleLevel. Parallels the
// positions buffer; Apple TBDR pays a heavy cost for vertex-stage texture
// sampling. The texture itself is preserved at @binding(3) because
// non-draw shaders (find-hovered-point etc.) still sample it.
@group(0) @binding(9) var<storage, read> pointStatusBuf: array<vec4<f32>>;
@group(0) @binding(10) var<storage, read> previousPositions: array<vec4<f32>>;

struct VertexInput {
  @location(0) quadCorner: vec2<f32>,
  @location(1) pointIndices: vec2<f32>,
  @location(2) size: f32,
  @location(3) color: vec4<f32>,
  @location(4) shape: f32,
  @location(5) imageIndex: f32,
  @location(6) imageSize: f32,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) pointShape: f32,
  @location(1) isGreyedOut: f32,
  @location(2) isOutlined: f32,
  @location(3) shapeColor: vec4<f32>,
  @location(4) imageAtlasUV: vec4<f32>,
  @location(5) shapeSize: f32,
  @location(6) imageSizeVarying: f32,
  @location(7) overallSize: f32,
  @location(8) pointCoord: vec2<f32>,
  @location(9) lodAlpha: f32,
  @location(10) visualDepth: f32,
};

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

const outlineRingScale: f32 = 1.3;`
