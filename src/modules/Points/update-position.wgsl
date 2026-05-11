// WGSL counterpart to update-position.frag + Shared/quad.vert.
// One file, both entry points, used when useWebGPU = true.

struct UpdatePositionUniforms {
  friction: f32,
  spaceSize: f32,
};

@group(0) @binding(0) var<uniform> updatePosition: UpdatePositionUniforms;
@group(0) @binding(1) var positionsTexture: texture_2d<f32>;
@group(0) @binding(2) var positionsSampler: sampler;
@group(0) @binding(3) var velocity: texture_2d<f32>;
@group(0) @binding(4) var velocitySampler: sampler;
@group(0) @binding(5) var pinnedStatusTexture: texture_2d<f32>;
@group(0) @binding(6) var pinnedStatusSampler: sampler;

struct VertexInput {
  @location(0) vertexCoord: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) textureCoords: vec2<f32>,
};

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  // [-1, 1] NDC -> [0, 1] texture coords
  output.textureCoords = (input.vertexCoord + vec2<f32>(1.0)) * 0.5;
  output.position = vec4<f32>(input.vertexCoord, 0.0, 1.0);
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  var pointPosition = textureSample(positionsTexture, positionsSampler, input.textureCoords);
  let pointVelocity = textureSample(velocity, velocitySampler, input.textureCoords);
  let pinnedStatus = textureSample(pinnedStatusTexture, pinnedStatusSampler, input.textureCoords);

  // Pinned points don't update
  if (pinnedStatus.r > 0.5) {
    return pointPosition;
  }

  let v = pointVelocity.rg * updatePosition.friction;
  pointPosition.r = clamp(pointPosition.r + v.r, 0.0, updatePosition.spaceSize);
  pointPosition.g = clamp(pointPosition.g + v.g, 0.0, updatePosition.spaceSize);

  return pointPosition;
}
