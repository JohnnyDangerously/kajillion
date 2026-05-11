// WGSL counterpart to calculate-centermass.vert + calculate-centermass.frag.
// One file, both entry points, used when useWebGPU = true.
//
// Custom vertex shader: one vertex per point (topology: 'point-list').
// Every vertex projects to the single 1x1 framebuffer pixel (NDC origin),
// and the blend-add accumulates positions to compute the global centermass.

struct CalculateCentermassUniforms {
  pointsTextureSize: f32,
};

@group(0) @binding(0) var<uniform> calculateCentermass: CalculateCentermassUniforms;
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

  let pointPosition = textureSampleLevel(
    positionsTexture,
    positionsTextureSampler,
    input.pointIndices / calculateCentermass.pointsTextureSize,
    0.0,
  );
  output.rgba = vec4<f32>(pointPosition.xy, 1.0, 0.0);

  output.position = vec4<f32>(0.0, 0.0, 0.0, 1.0);
  // NOTE: GLSL sets gl_PointSize = 1.0; WebGPU point primitives are always size 1.
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  return input.rgba;
}
