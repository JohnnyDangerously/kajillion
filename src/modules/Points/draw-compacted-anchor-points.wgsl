struct CompactedAnchorUniforms {
  screenSize: vec2<f32>,
  ratio: f32,
  pointSizeScale: f32,
  denseOpacity: f32,
  sparseOpacity: f32,
  maxPointSize: f32,
};

@group(0) @binding(0) var<uniform> compactedAnchor: CompactedAnchorUniforms;
@group(0) @binding(1) var<storage, read> anchorPositions: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> anchorColors: array<vec4<f32>>;

struct VertexInput {
  @location(0) quadCorner: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) local: vec2<f32>,
  @location(1) color: vec4<f32>,
  @location(2) alphaScale: f32,
};

@vertex
fn vertexMain(input: VertexInput, @builtin(instance_index) instanceIdx: u32) -> VertexOutput {
  var output: VertexOutput;
  let anchor = anchorPositions[instanceIdx];
  output.local = input.quadCorner;
  output.color = anchorColors[instanceIdx];
  output.alphaScale = 0.0;
  if (anchor.w == 0.0 || abs(anchor.x) > 1.05 || abs(anchor.y) > 1.05) {
    output.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
    return output;
  }

  let sparse = anchor.w > 0.0;
  let tileCount = abs(anchor.w);
  let density = clamp(log2(tileCount + 1.0) * 0.13, 0.0, 1.0);
  let sparseSize = mix(0.92, 1.08, density);
  let denseSize = mix(0.58, 0.88, density);
  let pointSize = max(anchor.z, 1.0);
  let sizePx = min(
    compactedAnchor.maxPointSize * compactedAnchor.ratio,
    compactedAnchor.pointSizeScale * pointSize * compactedAnchor.ratio * select(denseSize, sparseSize, sparse),
  );
  let framebufferSize = max(compactedAnchor.screenSize * compactedAnchor.ratio, vec2<f32>(1.0));
  let pixelCenter = vec2<f32>(
    (anchor.x * 0.5 + 0.5) * framebufferSize.x,
    (1.0 - (anchor.y * 0.5 + 0.5)) * framebufferSize.y,
  );
  let stablePixelCenter = floor(pixelCenter * 4.0 + vec2<f32>(0.5)) * 0.25;
  let stableClipCenter = vec2<f32>(
    stablePixelCenter.x / framebufferSize.x * 2.0 - 1.0,
    1.0 - stablePixelCenter.y / framebufferSize.y * 2.0,
  );
  let center = select(stableClipCenter, anchor.xy, sparse);
  let halfExtent = max(vec2<f32>(0.62), vec2<f32>(sizePx)) / (compactedAnchor.screenSize * compactedAnchor.ratio);
  output.position = vec4<f32>(center + input.quadCorner * halfExtent, 0.0, 1.0);
  let denseStabilityScale = 1.0 - smoothstep(0.40, 1.0, density) * 0.38;
  output.alphaScale = select(compactedAnchor.denseOpacity * denseStabilityScale, compactedAnchor.sparseOpacity, sparse);
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let r2 = dot(input.local, input.local);
  if (r2 > 1.0) {
    discard;
  }
  let edge = 1.0 - smoothstep(0.38, 1.0, r2);
  let core = 1.0 - smoothstep(0.0, 0.24, r2);
  let alpha = clamp((edge * 0.88 + core * 0.12) * input.color.a * input.alphaScale, 0.0, 0.86);
  let color = input.color.rgb;
  return vec4<f32>(color * alpha, alpha);
}
