// WGSL counterpart to calculate-centermass.vert + calculate-centermass.frag.
// One file, both entry points, used when useWebGPU = true.
//
// Custom vertex shader: one vertex per point (topology: 'point-list').
// Each vertex reads its cluster index from clusterTexture and projects to
// that cluster's pixel in the centermass framebuffer. Points with cluster
// index < 0 fall back to xy = vec2(0.0) in NDC (matches GLSL behavior).

struct CalculateCentermassUniforms {
  pointsTextureSize: f32,
  clustersTextureSize: f32,
};

@group(0) @binding(0) var<uniform> calculateCentermass: CalculateCentermassUniforms;
@group(0) @binding(1) var positionsTexture: texture_2d<f32>;
@group(0) @binding(2) var positionsSampler: sampler;
@group(0) @binding(3) var clusterTexture: texture_2d<f32>;
@group(0) @binding(4) var clusterTextureSampler: sampler;

struct VertexInput {
  @location(0) pointIndices: vec2f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) rgba: vec4f,
};

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  let uv = input.pointIndices / calculateCentermass.pointsTextureSize;

  let pointPosition = textureSampleLevel(positionsTexture, positionsSampler, uv, 0.0);
  output.rgba = vec4f(pointPosition.xy, 1.0, 0.0);

  let pointClusterIndices = textureSampleLevel(clusterTexture, clusterTextureSampler, uv, 0.0);
  var xy = vec2f(0.0);
  if (pointClusterIndices.x >= 0.0 && pointClusterIndices.y >= 0.0) {
    xy = 2.0 * (pointClusterIndices.xy + 0.5) / calculateCentermass.clustersTextureSize - 1.0;
  }

  output.position = vec4f(xy, 0.0, 1.0);
  // NOTE: GLSL sets gl_PointSize = 1.0; WebGPU point primitives are always size 1.
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  return input.rgba;
}
