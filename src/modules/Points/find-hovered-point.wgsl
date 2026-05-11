// WGSL counterpart to find-hovered-point.vert + find-hovered-point.frag.
// One file, both entry points, used when useWebGPU = true.
//
// Custom vertex shader: one vertex per point (topology: 'point-list').
// Tests whether each point lies under the mouse and, if so, writes its
// index/size/position into a 1x1 framebuffer at gl_Position = (-0.5,-0.5).
// All other points are written to (0.5, 0.5) and discarded in the fragment.

struct FindHoveredPointUniforms {
  pointsTextureSize: f32,
  sizeScale: f32,
  spaceSize: f32,
  screenSize: vec2<f32>,
  ratio: f32,
  transformationMatrix: mat4x4<f32>,
  mousePosition: vec2<f32>,
  scalePointsOnZoom: f32,
  maxPointSize: f32,
  skipHighlighted: f32,
  skipGreyed: f32,
};

@group(0) @binding(0) var<uniform> findHoveredPoint: FindHoveredPointUniforms;
@group(0) @binding(1) var positionsTexture: texture_2d<f32>;
@group(0) @binding(2) var positionsTextureSampler: sampler;
@group(0) @binding(3) var pointStatus: texture_2d<f32>;
@group(0) @binding(4) var pointStatusSampler: sampler;

struct VertexInput {
  @location(0) pointIndices: vec2<f32>,
  @location(1) size: f32,
  @location(2) imageSize: f32,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) rgba: vec4<f32>,
};

fn calculatePointSize(size: f32) -> f32 {
  let scale = findHoveredPoint.transformationMatrix[0][0];
  var pSize: f32;
  if (findHoveredPoint.scalePointsOnZoom > 0.0) {
    pSize = size * findHoveredPoint.ratio * scale;
  } else {
    pSize = size * findHoveredPoint.ratio * min(5.0, max(1.0, scale * 0.01));
  }
  return min(pSize, findHoveredPoint.maxPointSize * findHoveredPoint.ratio);
}

fn euclideanDistance(x1: f32, x2: f32, y1: f32, y2: f32) -> f32 {
  return sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  let uv = (input.pointIndices + vec2<f32>(0.5)) / findHoveredPoint.pointsTextureSize;

  let greyoutStatus = textureSampleLevel(pointStatus, pointStatusSampler, uv, 0.0);
  var isHighlighted: f32 = 0.0;
  if (greyoutStatus.r == 0.0) {
    isHighlighted = 1.0;
  }

  if (findHoveredPoint.skipHighlighted > 0.0 && isHighlighted > 0.0) {
    output.rgba = vec4<f32>(0.0);
    output.position = vec4<f32>(0.5, 0.5, 0.0, 1.0);
    // NOTE: GLSL sets gl_PointSize = 1.0; WebGPU point primitives are always size 1.
    return output;
  }
  if (findHoveredPoint.skipGreyed > 0.0 && isHighlighted <= 0.0) {
    output.rgba = vec4<f32>(0.0);
    output.position = vec4<f32>(0.5, 0.5, 0.0, 1.0);
    // NOTE: GLSL sets gl_PointSize = 1.0; WebGPU point primitives are always size 1.
    return output;
  }

  let pointPosition = textureSampleLevel(positionsTexture, positionsTextureSampler, uv, 0.0);
  let point = pointPosition.rg;

  var normalizedPosition = 2.0 * point / findHoveredPoint.spaceSize - vec2<f32>(1.0);
  normalizedPosition = normalizedPosition * (findHoveredPoint.spaceSize / findHoveredPoint.screenSize);

  // Equivalent to mat3(transformationMatrix) * vec3(normalizedPosition, 1)
  let finalPosition = findHoveredPoint.transformationMatrix * vec4<f32>(normalizedPosition, 1.0, 1.0);

  let shapeSizeValue = calculatePointSize(input.size * findHoveredPoint.sizeScale);
  let imageSizeValue = calculatePointSize(input.imageSize * findHoveredPoint.sizeScale);
  let pointRadius = 0.5 * max(shapeSizeValue, imageSizeValue);
  let pointScreenPosition = (finalPosition.xy + vec2<f32>(1.0)) * findHoveredPoint.screenSize / 2.0;

  output.rgba = vec4<f32>(0.0);
  output.position = vec4<f32>(0.5, 0.5, 0.0, 1.0);

  let dist = euclideanDistance(
    pointScreenPosition.x,
    findHoveredPoint.mousePosition.x,
    pointScreenPosition.y,
    findHoveredPoint.mousePosition.y,
  );
  if (dist < pointRadius / findHoveredPoint.ratio) {
    let index = input.pointIndices.g * findHoveredPoint.pointsTextureSize + input.pointIndices.r;
    output.rgba = vec4<f32>(index, max(input.size, input.imageSize), pointPosition.xy);
    output.position = vec4<f32>(-0.5, -0.5, 0.0, 1.0);
  }

  // NOTE: GLSL sets gl_PointSize = 1.0; WebGPU point primitives are always size 1.
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  if (input.rgba.g <= 0.0) {
    discard;
  }
  return input.rgba;
}
