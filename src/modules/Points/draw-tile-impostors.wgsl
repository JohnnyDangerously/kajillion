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
};

@group(0) @binding(0) var<uniform> tileRender: TileRenderUniforms;
@group(0) @binding(1) var<storage, read> resolvedTiles: array<vec4<f32>>;

struct VertexInput {
  @location(0) quadCorner: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) local: vec2<f32>,
  @location(1) tileData: vec4<f32>,
  @location(2) dotAlpha: f32,
};

fn hash01(xIn: u32) -> f32 {
  var x = xIn + 1u;
  x = (x ^ (x >> 16u)) * 0x7feb352du;
  x = (x ^ (x >> 15u)) * 0x846ca68bu;
  x = x ^ (x >> 16u);
  return f32(x & 0x00ffffffu) / 16777216.0;
}

fn sampleUnit(tileIndex: u32, microIndex: u32) -> vec2<f32> {
  let seed = tileIndex * 747796405u + microIndex * 2891336453u;
  let a = hash01(seed);
  let b = hash01(seed ^ 0x9e3779b9u);
  return vec2<f32>(a, b) * 2.0 - vec2<f32>(1.0);
}

fn covarianceOffset(sample: vec2<f32>, variance: vec2<f32>, covariance: f32) -> vec2<f32> {
  let sx = sqrt(clamp(variance.x, 0.002, 0.18));
  let sy = sqrt(clamp(variance.y, 0.002, 0.18));
  let shear = clamp(covariance / max(sx * sy, 0.001), -0.70, 0.70);
  return vec2<f32>(
    sample.x * sx + sample.y * sy * shear * 0.45,
    sample.y * sy,
  );
}

@vertex
fn vertexMain(input: VertexInput, @builtin(instance_index) rawInstanceIdx: u32) -> VertexOutput {
  var output: VertexOutput;
  let microCount = max(tileRender.microSplats, 1u);
  let instanceIdx = rawInstanceIdx / microCount;
  let microIndex = rawInstanceIdx - instanceIdx * microCount;
  let data = resolvedTiles[instanceIdx];
  if (data.x <= tileRender.sparseTileThreshold) {
    output.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
    output.local = input.quadCorner;
    output.tileData = data;
    output.dotAlpha = 0.0;
    return output;
  }

  let columns = tileRender.tileColumns;
  let tileX = instanceIdx % columns;
  let tileY = instanceIdx / columns;
  let tileMeta = resolvedTiles[instanceIdx + columns * tileRender.tileRows];
  let tileMoment = resolvedTiles[instanceIdx + columns * tileRender.tileRows * 2u];
  let centroid = clamp(tileMeta.xy, vec2<f32>(0.08), vec2<f32>(0.92));
  let framebufferSize = max(tileRender.screenSize * tileRender.ratio, vec2<f32>(1.0));
  let sample = sampleUnit(instanceIdx, microIndex);
  let occupancy = clamp(data.x / max(f32(microCount), 1.0), 0.0, 1.0);
  if (hash01(instanceIdx ^ (microIndex * 2246822519u)) > occupancy && microIndex > 0u) {
    output.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
    output.local = input.quadCorner;
    output.tileData = data;
    output.dotAlpha = 0.0;
    return output;
  }

  let distribution = covarianceOffset(sample, tileMeta.zw, tileMoment.x);
  let sampleLocal = clamp(centroid + distribution * 1.35, vec2<f32>(0.05), vec2<f32>(0.95));
  let rawPixelCenter = (vec2<f32>(f32(tileX), f32(tileY)) + sampleLocal) * tileRender.tileSize;
  let pixelCenter = floor(rawPixelCenter * 4.0 + vec2<f32>(0.5)) * 0.25;
  let center = vec2<f32>(
    pixelCenter.x / framebufferSize.x * 2.0 - 1.0,
    1.0 - pixelCenter.y / framebufferSize.y * 2.0,
  );
  let density = clamp(log2(data.x + 1.0) * 0.18 * tileRender.strength, 0.0, 1.0);
  let rawRadiusPx = clamp(tileRender.tileSize * mix(0.20, 0.42, density), 1.15, 3.25);
  let radiusPx = floor(rawRadiusPx * 4.0 + 0.5) * 0.25;
  let halfExtent = radiusPx / framebufferSize;
  output.position = vec4<f32>(center + input.quadCorner * halfExtent, 0.0, 1.0);
  output.local = input.quadCorner;
  output.tileData = data;
  output.dotAlpha = clamp((0.18 + density * 0.42) * tileRender.opacity, 0.0, 0.62);
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let count = input.tileData.x;
  if (count <= tileRender.sparseTileThreshold) {
    discard;
  }

  let r2 = dot(input.local, input.local);
  if (r2 > 1.0) {
    discard;
  }
  let core = 1.0 - smoothstep(0.0, 0.58, r2);
  let edge = 1.0 - smoothstep(0.56, 1.0, r2);
  let color = input.tileData.yzw;
  let alpha = clamp((edge * 0.90 + core * 0.10) * input.dotAlpha, 0.0, 0.32);
  return vec4<f32>(color * alpha, alpha);
}
