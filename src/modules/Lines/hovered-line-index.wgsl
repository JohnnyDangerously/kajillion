// WGSL counterpart to hovered-line-index.vert + hovered-line-index.frag.
// One file, both entry points, used when useWebGPU = true.
//
// Full-screen quad (topology: 'triangle-strip', 4 vertices). The fragment
// shader samples linkIndexTexture at the mouse position and emits the link
// index (or -1 sentinel) to a 1x1 framebuffer.

struct HoveredLineIndexUniforms {
  mousePosition: vec2f,
  screenSize: vec2f,
};

@group(0) @binding(0) var<uniform> hoveredLine: HoveredLineIndexUniforms;
@group(0) @binding(1) var linkIndexTexture: texture_2d<f32>;
@group(0) @binding(2) var linkIndexTextureSampler: sampler;

struct VertexInput {
  @location(0) vertexCoord: vec2f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
};

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(input.vertexCoord, 0.0, 1.0);
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  // Convert mouse position to texture coordinates
  let texCoord = hoveredLine.mousePosition / hoveredLine.screenSize;

  // Read the link index from the linkIndexFbo texture at mouse position
  let linkIndexData = textureSample(linkIndexTexture, linkIndexTextureSampler, texCoord);

  // Extract the link index (stored in the red channel)
  let linkIndex = linkIndexData.r;

  // Check if there's a valid link at this position (alpha > 0)
  if (linkIndexData.a > 0.0 && linkIndex >= 0.0) {
    return vec4f(linkIndex, 0.0, 0.0, 1.0);
  }
  // No link at this position, output -1 to indicate no hover
  return vec4f(-1.0, 0.0, 0.0, 0.0);
}
