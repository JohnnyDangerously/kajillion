// WGSL counterpart to force-mouse.frag + Shared/quad.vert.
// One file, both entry points, used when useWebGPU = true.

struct ForceMouseUniforms {
  repulsion: f32,
  mousePos: vec2f,
};

@group(0) @binding(0) var<uniform> forceMouse: ForceMouseUniforms;
@group(0) @binding(1) var positionsTexture: texture_2d<f32>;
@group(0) @binding(2) var positionsSampler: sampler;

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
  let pointPosition = textureSample(positionsTexture, positionsSampler, input.textureCoords);
  var velocity = vec4f(0.0);
  let mouse = forceMouse.mousePos;

  // Move particles away from the mouse position using a repulsive force
  let distVector = mouse - pointPosition.rg;
  var dist = sqrt(dot(distVector, distVector));
  dist = max(dist, 10.0);
  let angle = atan2(distVector.y, distVector.x);
  let addV = 100.0 * forceMouse.repulsion / (dist * dist);
  velocity = vec4f(velocity.rg - addV * vec2f(cos(angle), sin(angle)), velocity.ba);

  return velocity;
}
