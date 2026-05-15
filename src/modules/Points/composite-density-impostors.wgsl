struct CompositeUniforms {
  strength: f32,
  opacity: f32,
};

@group(0) @binding(0) var<uniform> composite: CompositeUniforms;
@group(0) @binding(1) var densityTexture: texture_2d<f32>;
@group(0) @binding(2) var densityTextureSampler: sampler;

struct VertexInput {
  @location(0) quadCorner: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4<f32>(input.quadCorner, 0.0, 1.0);
  output.uv = input.quadCorner * 0.5 + vec2<f32>(0.5);
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let density = textureSampleLevel(densityTexture, densityTextureSampler, input.uv, 0.0);
  let color = vec3<f32>(1.0) - exp(-max(density.rgb, vec3<f32>(0.0)) * composite.strength);
  let alpha = clamp(max(max(color.r, color.g), color.b) * composite.opacity, 0.0, 0.92);
  return vec4<f32>(color * alpha, alpha);
}
