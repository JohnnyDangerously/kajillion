export function binTileImpostorsComputeWgsl (): string {
  return `
struct TileImpostorUniforms {
  ratio: f32,
  transformationMatrix: mat4x4<f32>,
  spaceSize: f32,
  screenSize: vec2<f32>,
  tileSize: f32,
  pointCount: u32,
  tileColumns: u32,
  tileRows: u32,
  colorScale: u32,
  positionScale: u32,
  buildSampleRate: f32,
  buildSampleWeight: u32,
};

struct AtomicTile {
  count: atomic<u32>,
  r: atomic<u32>,
  g: atomic<u32>,
  b: atomic<u32>,
  x: atomic<u32>,
  y: atomic<u32>,
  xx: atomic<u32>,
  yy: atomic<u32>,
  xy: atomic<u32>,
};

@group(0) @binding(0) var<uniform> tileUniforms: TileImpostorUniforms;
@group(0) @binding(1) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> colors: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> atomicTiles: array<AtomicTile>;

const TILE_ATOMIC_LANES: u32 = 4u;

fn projectPoint(point: vec2<f32>) -> vec2<f32> {
  var normalizedPosition = 2.0 * point / tileUniforms.spaceSize - vec2<f32>(1.0);
  normalizedPosition = normalizedPosition * (tileUniforms.spaceSize / tileUniforms.screenSize);
  let finalPosition = tileUniforms.transformationMatrix * vec4<f32>(normalizedPosition, 1.0, 1.0);
  return finalPosition.xy;
}

fn hash01(index: u32) -> f32 {
  var x = index + 1u;
  x = (x ^ (x >> 16u)) * 0x7feb352du;
  x = (x ^ (x >> 15u)) * 0x846ca68bu;
  x = x ^ (x >> 16u);
  return f32(x & 0x00ffffffu) / 16777216.0;
}

fn hashU32(index: u32) -> u32 {
  var x = index + 1u;
  x = (x ^ (x >> 16u)) * 0x7feb352du;
  x = (x ^ (x >> 15u)) * 0x846ca68bu;
  x = x ^ (x >> 16u);
  return x;
}

@compute @workgroup_size(64)
fn computeMain(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= tileUniforms.pointCount) { return; }

  let sampleRate = clamp(tileUniforms.buildSampleRate, 0.02, 1.0);
  if (sampleRate < 0.999 && hash01(i) > sampleRate) { return; }

  let clip = projectPoint(positions[i].xy);
  if (abs(clip.x) > 1.0 || abs(clip.y) > 1.0) { return; }

  let pixel = vec2<f32>(
    (clip.x * 0.5 + 0.5) * tileUniforms.screenSize.x * tileUniforms.ratio,
    (1.0 - (clip.y * 0.5 + 0.5)) * tileUniforms.screenSize.y * tileUniforms.ratio,
  );
  let tileX = u32(clamp(floor(pixel.x / tileUniforms.tileSize), 0.0, f32(tileUniforms.tileColumns - 1u)));
  let tileY = u32(clamp(floor(pixel.y / tileUniforms.tileSize), 0.0, f32(tileUniforms.tileRows - 1u)));
  let tileIndex = tileY * tileUniforms.tileColumns + tileX;
  let lane = hashU32(i ^ (tileIndex * 0x9e3779b9u)) % TILE_ATOMIC_LANES;
  let atomicIndex = tileIndex * TILE_ATOMIC_LANES + lane;

  let colorScale = f32(tileUniforms.colorScale);
  let positionScale = f32(tileUniforms.positionScale);
  let tileOrigin = vec2<f32>(f32(tileX), f32(tileY)) * tileUniforms.tileSize;
  let local = clamp((pixel - tileOrigin) / tileUniforms.tileSize, vec2<f32>(0.0), vec2<f32>(1.0));
  let color = clamp(colors[i], vec4<f32>(0.0), vec4<f32>(1.0));
  let sampleWeight = max(tileUniforms.buildSampleWeight, 1u);
  atomicAdd(&atomicTiles[atomicIndex].count, sampleWeight);
  atomicAdd(&atomicTiles[atomicIndex].r, u32(round(color.r * colorScale)) * sampleWeight);
  atomicAdd(&atomicTiles[atomicIndex].g, u32(round(color.g * colorScale)) * sampleWeight);
  atomicAdd(&atomicTiles[atomicIndex].b, u32(round(color.b * colorScale)) * sampleWeight);
  atomicAdd(&atomicTiles[atomicIndex].x, u32(round(local.x * positionScale)) * sampleWeight);
  atomicAdd(&atomicTiles[atomicIndex].y, u32(round(local.y * positionScale)) * sampleWeight);
  atomicAdd(&atomicTiles[atomicIndex].xx, u32(round(local.x * local.x * positionScale)) * sampleWeight);
  atomicAdd(&atomicTiles[atomicIndex].yy, u32(round(local.y * local.y * positionScale)) * sampleWeight);
  atomicAdd(&atomicTiles[atomicIndex].xy, u32(round(local.x * local.y * positionScale)) * sampleWeight);
}
`
}
