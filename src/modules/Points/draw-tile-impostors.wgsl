struct TileRenderUniforms {
  screenSize: vec2<f32>,
  ratio: f32,
  tileColumns: u32,
  tileRows: u32,
  tileSize: f32,
  opacity: f32,
  strength: f32,
  microSplats: u32,
  sparseTileThreshold: f32,
  massRadiusScale: f32,
  massThreshold: f32,
  massMaxAlpha: f32,
  massColorBoost: f32,
  massExtrusion: f32,
};

@group(0) @binding(0) var<uniform> tileRender: TileRenderUniforms;
@group(0) @binding(1) var<storage, read> resolvedTiles: array<vec4<f32>>;

struct VertexInput {
  @location(0) quadCorner: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) local: vec2<f32>,
  @location(1) color: vec3<f32>,
  @location(2) alphaScale: f32,
};

fn hiddenVertex(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
  output.local = input.quadCorner;
  output.color = vec3<f32>(0.0);
  output.alphaScale = 0.0;
  return output;
}

fn covarianceAxes(variance: vec2<f32>, covariance: f32) -> mat2x2<f32> {
  let delta = sqrt(max((variance.x - variance.y) * (variance.x - variance.y) + 4.0 * covariance * covariance, 0.0));
  let lambdaMajor = max(0.0008, (variance.x + variance.y + delta) * 0.5);
  var major = vec2<f32>(1.0, 0.0);
  if (abs(covariance) > 0.0001 || abs(lambdaMajor - variance.x) > 0.0001) {
    major = normalize(vec2<f32>(covariance, lambdaMajor - variance.x));
  }
  let minor = vec2<f32>(-major.y, major.x);
  return mat2x2<f32>(major, minor);
}

@vertex
fn vertexMain(input: VertexInput, @builtin(instance_index) rawInstanceIdx: u32) -> VertexOutput {
  let microCount = max(tileRender.microSplats, 1u);
  let instanceIdx = rawInstanceIdx / microCount;
  let microIndex = rawInstanceIdx - instanceIdx * microCount;
  if (microIndex > 0u) {
    return hiddenVertex(input);
  }

  let tileCount = tileRender.tileColumns * tileRender.tileRows;
  if (instanceIdx >= tileCount) {
    return hiddenVertex(input);
  }

  let data = resolvedTiles[instanceIdx];
  if (data.x <= tileRender.sparseTileThreshold) {
    return hiddenVertex(input);
  }

  let columns = tileRender.tileColumns;
  let tileX = instanceIdx % columns;
  let tileY = instanceIdx / columns;
  let tileMeta = resolvedTiles[instanceIdx + tileCount];
  let tileMoment = resolvedTiles[instanceIdx + tileCount * 2u];
  let centroid = clamp(tileMeta.xy, vec2<f32>(0.04), vec2<f32>(0.96));
  let variance = clamp(tileMeta.zw, vec2<f32>(0.0012), vec2<f32>(0.22));
  let covariance = clamp(tileMoment.x, -0.18, 0.18);

  let framebufferSize = max(tileRender.screenSize * tileRender.ratio, vec2<f32>(1.0));
  let pixelCenter = (vec2<f32>(f32(tileX), f32(tileY)) + centroid) * tileRender.tileSize;
  let clipCenter = vec2<f32>(
    pixelCenter.x / framebufferSize.x * 2.0 - 1.0,
    1.0 - pixelCenter.y / framebufferSize.y * 2.0,
  );

  let delta = sqrt(max((variance.x - variance.y) * (variance.x - variance.y) + 4.0 * covariance * covariance, 0.0));
  let lambdaMajor = max(0.0008, (variance.x + variance.y + delta) * 0.5);
  let lambdaMinor = max(0.0008, (variance.x + variance.y - delta) * 0.5);
  let rawDensity = clamp(log2(data.x + 1.0) * 0.15 * max(tileRender.strength, 0.001), 0.0, 1.0);
  let threshold = clamp(tileRender.massThreshold, 0.0, 0.95);
  let density = smoothstep(threshold, 1.0, rawDensity);
  if (density <= 0.0001) {
    return hiddenVertex(input);
  }

  let radiusScale = max(tileRender.massRadiusScale, 0.05);
  let massScale = mix(1.35, 2.45, density) * radiusScale;
  let radiusMajorPx = clamp(sqrt(lambdaMajor) * tileRender.tileSize * massScale, 1.15, tileRender.tileSize * 1.55);
  let radiusMinorPx = clamp(sqrt(lambdaMinor) * tileRender.tileSize * massScale, 0.95, tileRender.tileSize * 1.20);
  let axes = covarianceAxes(variance, covariance);
  let pixelOffset = axes[0] * input.quadCorner.x * radiusMajorPx + axes[1] * input.quadCorner.y * radiusMinorPx;
  let extrusionPx = -density * max(tileRender.massExtrusion, 0.0) * tileRender.tileSize;
  let clipOffset = vec2<f32>(
    pixelOffset.x / framebufferSize.x * 2.0,
    (-pixelOffset.y + extrusionPx) / framebufferSize.y * 2.0,
  );

  var output: VertexOutput;
  output.position = vec4<f32>(clipCenter + clipOffset, 0.0, 1.0);
  output.local = input.quadCorner;
  output.color = clamp(data.yzw * max(tileRender.massColorBoost, 0.0), vec3<f32>(0.0), vec3<f32>(4.0));

  let opticalDepth = max(0.0, data.x - tileRender.sparseTileThreshold) * tileRender.opacity * max(tileRender.strength, 0.001);
  output.alphaScale = clamp(1.0 - exp(-opticalDepth * 0.10), 0.0, max(tileRender.massMaxAlpha, 0.0));
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let r2 = dot(input.local, input.local);
  if (r2 > 1.0) {
    discard;
  }

  let gaussian = exp(-r2 * 3.2);
  let edgeFade = 1.0 - smoothstep(0.82, 1.0, r2);
  let alpha = clamp(gaussian * edgeFade * input.alphaScale, 0.0, max(tileRender.massMaxAlpha, 0.0));
  return vec4<f32>(input.color * alpha, alpha);
}
