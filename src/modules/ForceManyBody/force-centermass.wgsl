// WGSL counterpart to force-centermass.frag + Shared/quad.vert.
// One file, both entry points, used when useWebGPU = true.

struct ForceCenterUniforms {
  levelTextureSize: f32,
  alpha: f32,
  repulsion: f32,
};

@group(0) @binding(0) var<uniform> forceCenter: ForceCenterUniforms;
@group(0) @binding(1) var positionsTexture: texture_2d<f32>;
@group(0) @binding(2) var positionsSampler: sampler;
@group(0) @binding(3) var levelFbo: texture_2d<f32>;
@group(0) @binding(4) var levelFboSampler: sampler;
@group(0) @binding(5) var randomValues: texture_2d<f32>;
@group(0) @binding(6) var randomValuesSampler: sampler;

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

// Calculate the additional velocity based on the center of mass
fn calculateAdditionalVelocity(ij: vec2f, pp: vec2f) -> vec2f {
  var add = vec2f(0.0);
  let centermass = textureSample(levelFbo, levelFboSampler, ij);
  if (centermass.r > 0.0 && centermass.g > 0.0 && centermass.b > 0.0) {
    let centermassPosition = centermass.rg / centermass.b;
    let distVector = pp - centermassPosition;
    var l = dot(distVector, distVector);
    let dist = sqrt(l);
    if (l > 0.0) {
      let angle = atan2(distVector.y, distVector.x);
      let c = forceCenter.alpha * forceCenter.repulsion * centermass.b;

      let distanceMin2: f32 = 1.0;
      if (l < distanceMin2) {
        l = sqrt(distanceMin2 * l);
      }
      let addV = c / sqrt(l);
      add = addV * vec2f(cos(angle), sin(angle));
    }
  }
  return add;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let pointPosition = textureSample(positionsTexture, positionsSampler, input.textureCoords);
  let random = textureSample(randomValues, randomValuesSampler, input.textureCoords);

  var velocity = vec4f(0.0);

  // Calculate additional velocity based on the point position
  let added = calculateAdditionalVelocity(pointPosition.xy / forceCenter.levelTextureSize, pointPosition.xy);
  velocity = vec4f(velocity.xy + added, velocity.zw);
  // Apply random factor to the velocity
  velocity = vec4f(velocity.xy + velocity.xy * random.rg, velocity.zw);

  return velocity;
}
