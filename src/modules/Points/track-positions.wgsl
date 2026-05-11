// WGSL counterpart to track-positions.frag + Shared/quad.vert.
// One file, both entry points, used when useWebGPU = true.

struct TrackPointsUniforms {
  pointsTextureSize: f32,
};

@group(0) @binding(0) var<uniform> trackPoints: TrackPointsUniforms;
@group(0) @binding(1) var positionsTexture: texture_2d<f32>;
@group(0) @binding(2) var positionsTextureSampler: sampler;
@group(0) @binding(3) var trackedIndices: texture_2d<f32>;
@group(0) @binding(4) var trackedIndicesSampler: sampler;

struct VertexInput {
  @location(0) vertexCoord: vec2f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) textureCoords: vec2f,
};

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  // [-1, 1] NDC -> [0, 1] texture coords
  output.textureCoords = (input.vertexCoord + vec2f(1.0)) * 0.5;
  output.position = vec4f(input.vertexCoord, 0.0, 1.0);
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let trackedPointIndices = textureSample(trackedIndices, trackedIndicesSampler, input.textureCoords);
  if (trackedPointIndices.r < 0.0) {
    discard;
  }
  let pointPosition = textureSample(
    positionsTexture,
    positionsTextureSampler,
    (trackedPointIndices.rg + 0.5) / trackPoints.pointsTextureSize,
  );

  return vec4f(pointPosition.rg, 1.0, 1.0);
}
