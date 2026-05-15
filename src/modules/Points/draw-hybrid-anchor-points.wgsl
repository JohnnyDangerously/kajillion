struct HybridAnchorUniforms {
  ratio: f32,
  transformationMatrix: mat4x4<f32>,
  spaceSize: f32,
  screenSize: vec2<f32>,
  tileSize: f32,
  tileColumns: u32,
  tileRows: u32,
  pointSizeScale: f32,
  denseSampleRate: f32,
  denseOpacity: f32,
  sparseOpacity: f32,
  sparseTileThreshold: f32,
  maxPointSize: f32,
};

@group(0) @binding(0) var<uniform> hybridAnchor: HybridAnchorUniforms;
@group(0) @binding(1) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> colors: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> resolvedTiles: array<vec4<f32>>;

struct VertexInput {
  @location(0) quadCorner: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) local: vec2<f32>,
  @location(1) color: vec4<f32>,
  @location(2) alphaScale: f32,
};

fn hash01(index: u32) -> f32 {
  var x = index + 1u;
  x = (x ^ (x >> 16u)) * 0x7feb352du;
  x = (x ^ (x >> 15u)) * 0x846ca68bu;
  x = x ^ (x >> 16u);
  return f32(x & 0x00ffffffu) / 16777216.0;
}

fn projectPoint(point: vec2<f32>) -> vec2<f32> {
  var normalizedPosition = 2.0 * point / hybridAnchor.spaceSize - vec2<f32>(1.0);
  normalizedPosition = normalizedPosition * (hybridAnchor.spaceSize / hybridAnchor.screenSize);
  let finalPosition = hybridAnchor.transformationMatrix * vec4<f32>(normalizedPosition, 1.0, 1.0);
  return finalPosition.xy;
}

fn tileCountAt(clip: vec2<f32>) -> f32 {
  let pixel = vec2<f32>(
    (clip.x * 0.5 + 0.5) * hybridAnchor.screenSize.x * hybridAnchor.ratio,
    (1.0 - (clip.y * 0.5 + 0.5)) * hybridAnchor.screenSize.y * hybridAnchor.ratio,
  );
  let tileX = u32(clamp(floor(pixel.x / hybridAnchor.tileSize), 0.0, f32(hybridAnchor.tileColumns - 1u)));
  let tileY = u32(clamp(floor(pixel.y / hybridAnchor.tileSize), 0.0, f32(hybridAnchor.tileRows - 1u)));
  let tileIndex = tileY * hybridAnchor.tileColumns + tileX;
  return resolvedTiles[tileIndex].x;
}

@vertex
fn vertexMain(input: VertexInput, @builtin(instance_index) instanceIdx: u32) -> VertexOutput {
  var output: VertexOutput;
  output.local = input.quadCorner;
  output.color = vec4<f32>(0.0);
  output.alphaScale = 0.0;

  let clip = projectPoint(positions[instanceIdx].xy);
  if (abs(clip.x) > 1.02 || abs(clip.y) > 1.02) {
    output.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
    return output;
  }

  let tileCount = tileCountAt(clip);
  let sparse = tileCount <= hybridAnchor.sparseTileThreshold;
  if (!sparse && hash01(instanceIdx) > hybridAnchor.denseSampleRate) {
    output.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
    return output;
  }

  let density = clamp(log2(tileCount + 1.0) * 0.13, 0.0, 1.0);
  let sparseSize = mix(0.92, 1.35, density);
  let denseSize = mix(0.54, 0.88, density);
  let sizePx = min(
    hybridAnchor.maxPointSize * hybridAnchor.ratio,
    hybridAnchor.pointSizeScale * hybridAnchor.ratio * select(denseSize, sparseSize, sparse),
  );
  let halfExtent = max(vec2<f32>(0.65), vec2<f32>(sizePx)) / (hybridAnchor.screenSize * hybridAnchor.ratio);
  let framebufferSize = max(hybridAnchor.screenSize * hybridAnchor.ratio, vec2<f32>(1.0));
  let pixelCenter = vec2<f32>(
    (clip.x * 0.5 + 0.5) * framebufferSize.x,
    (1.0 - (clip.y * 0.5 + 0.5)) * framebufferSize.y,
  );
  let stablePixelCenter = floor(pixelCenter * 4.0 + vec2<f32>(0.5)) * 0.25;
  let stableClipCenter = vec2<f32>(
    stablePixelCenter.x / framebufferSize.x * 2.0 - 1.0,
    1.0 - stablePixelCenter.y / framebufferSize.y * 2.0,
  );
  let center = select(stableClipCenter, clip, sparse);
  output.position = vec4<f32>(center + input.quadCorner * halfExtent, 0.0, 1.0);
  output.color = colors[instanceIdx];
  let denseStabilityScale = 1.0 - smoothstep(0.40, 1.0, density) * 0.38;
  output.alphaScale = select(hybridAnchor.denseOpacity * denseStabilityScale, hybridAnchor.sparseOpacity, sparse);
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
