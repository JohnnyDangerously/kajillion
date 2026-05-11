// WGSL counterpart to fill-sampled-points.vert + fill-sampled-points.frag.
// One file, both entry points, used when useWebGPU = true.
//
// Custom vertex shader: one vertex per point (topology: 'point-list').
// Each vertex reads its world-space position from positionsTexture, projects
// to screen space, and writes (index, 1.0, x, y) into the sampled-points FBO
// cell at that screen pixel.

struct FillSampledPointsUniforms {
  pointsTextureSize: f32,
  transformationMatrix: mat4x4<f32>,
  spaceSize: f32,
  screenSize: vec2<f32>,
};

@group(0) @binding(0) var<uniform> fillSampledPoints: FillSampledPointsUniforms;
@group(0) @binding(1) var positionsTexture: texture_2d<f32>;
@group(0) @binding(2) var positionsTextureSampler: sampler;

struct VertexInput {
  @location(0) pointIndices: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) rgba: vec4<f32>,
};

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  let uv = (input.pointIndices + vec2<f32>(0.5)) / fillSampledPoints.pointsTextureSize;
  let pointPosition = textureSampleLevel(positionsTexture, positionsTextureSampler, uv, 0.0);

  var p = 2.0 * pointPosition.rg / fillSampledPoints.spaceSize - vec2<f32>(1.0);
  p = p * (fillSampledPoints.spaceSize / fillSampledPoints.screenSize);

  // Equivalent to mat3(transformationMatrix) * vec3(p, 1)
  let finalPos = fillSampledPoints.transformationMatrix * vec4<f32>(p, 1.0, 1.0);

  let pointScreenPosition = (finalPos.xy + vec2<f32>(1.0)) * fillSampledPoints.screenSize / 2.0;
  let index = input.pointIndices.g * fillSampledPoints.pointsTextureSize + input.pointIndices.r;
  output.rgba = vec4<f32>(index, 1.0, pointPosition.xy);

  let i = (pointScreenPosition.x + 0.5) / fillSampledPoints.screenSize.x;
  let j = (pointScreenPosition.y + 0.5) / fillSampledPoints.screenSize.y;
  output.position = vec4<f32>(2.0 * vec2<f32>(i, j) - vec2<f32>(1.0), 0.0, 1.0);

  // NOTE: GLSL sets gl_PointSize = 1.0; WebGPU point primitives are always size 1.
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  return input.rgba;
}
