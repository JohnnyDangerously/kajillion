// WGSL counterpart to force-gravity.frag + Shared/quad.vert.
// One file, both entry points, used when useWebGPU = true.

struct ForceGravityUniforms {
  gravity: f32,
  spaceSize: f32,
  alpha: f32,
};

@group(0) @binding(0) var<uniform> forceGravity: ForceGravityUniforms;
@group(0) @binding(1) var positionsTexture: texture_2d<f32>;
@group(0) @binding(2) var positionsSampler: sampler;

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
  let pointPosition = textureSample(positionsTexture, positionsSampler, input.textureCoords);

  var velocity = vec4<f32>(0.0);

  let centerPosition = vec2<f32>(forceGravity.spaceSize * 0.5);
  let distVector = centerPosition - pointPosition.rg;
  let dist = sqrt(dot(distVector, distVector));
  if (dist > 0.0) {
    let angle = atan2(distVector.y, distVector.x);
    let additionalVelocity = forceGravity.alpha * forceGravity.gravity * dist * 0.1;
    velocity = vec4<f32>(velocity.rg + additionalVelocity * vec2<f32>(cos(angle), sin(angle)), velocity.ba);
  }

  return velocity;
}
