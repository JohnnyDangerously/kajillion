// WGSL counterpart to drag-point.frag + Shared/quad.vert.
// One file, both entry points, used when useWebGPU = true.

struct DragPointUniforms {
  mousePos: vec2f,
  index: f32,
};

@group(0) @binding(0) var<uniform> dragPoint: DragPointUniforms;
@group(0) @binding(1) var positionsTexture: texture_2d<f32>;
@group(0) @binding(2) var positionsTextureSampler: sampler;

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
  var pointPosition = textureSample(positionsTexture, positionsTextureSampler, input.textureCoords);

  // Check if a point is being dragged
  if (dragPoint.index >= 0.0 && dragPoint.index == pointPosition.b) {
    pointPosition.r = dragPoint.mousePos.x;
    pointPosition.g = dragPoint.mousePos.y;
  }

  return pointPosition;
}
