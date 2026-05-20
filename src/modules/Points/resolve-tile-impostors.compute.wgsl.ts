export function resolveTileImpostorsComputeWgsl (): string {
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
@group(0) @binding(1) var<storage, read_write> atomicTiles: array<AtomicTile>;
@group(0) @binding(2) var<storage, read_write> resolvedTiles: array<vec4<f32>>;

const TILE_ATOMIC_LANES: u32 = 4u;

@compute @workgroup_size(64)
fn computeMain(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let tileCount = tileUniforms.tileColumns * tileUniforms.tileRows;
  if (i >= tileCount) { return; }

  var count = 0u;
  var sumR = 0u;
  var sumG = 0u;
  var sumB = 0u;
  var sumX = 0u;
  var sumY = 0u;
  var sumXX = 0u;
  var sumYY = 0u;
  var sumXY = 0u;
  for (var lane = 0u; lane < TILE_ATOMIC_LANES; lane = lane + 1u) {
    let atomicIndex = i * TILE_ATOMIC_LANES + lane;
    count = count + atomicLoad(&atomicTiles[atomicIndex].count);
    sumR = sumR + atomicLoad(&atomicTiles[atomicIndex].r);
    sumG = sumG + atomicLoad(&atomicTiles[atomicIndex].g);
    sumB = sumB + atomicLoad(&atomicTiles[atomicIndex].b);
    sumX = sumX + atomicLoad(&atomicTiles[atomicIndex].x);
    sumY = sumY + atomicLoad(&atomicTiles[atomicIndex].y);
    sumXX = sumXX + atomicLoad(&atomicTiles[atomicIndex].xx);
    sumYY = sumYY + atomicLoad(&atomicTiles[atomicIndex].yy);
    sumXY = sumXY + atomicLoad(&atomicTiles[atomicIndex].xy);
  }
  if (count == 0u) {
    resolvedTiles[i] = vec4<f32>(0.0);
    resolvedTiles[i + tileCount] = vec4<f32>(0.0);
    resolvedTiles[i + tileCount * 2u] = vec4<f32>(0.0);
    return;
  }

  let denom = f32(count) * f32(tileUniforms.colorScale);
  let positionDenom = f32(count) * f32(tileUniforms.positionScale);
  let color = vec3<f32>(
    f32(sumR) / denom,
    f32(sumG) / denom,
    f32(sumB) / denom,
  );
  let local = vec2<f32>(
    f32(sumX) / positionDenom,
    f32(sumY) / positionDenom,
  );
  let secondMoment = vec3<f32>(
    f32(sumXX) / positionDenom,
    f32(sumYY) / positionDenom,
    f32(sumXY) / positionDenom,
  );
  let variance = max(secondMoment.xy - local * local, vec2<f32>(0.0012));
  let covariance = clamp(secondMoment.z - local.x * local.y, -0.18, 0.18);
  resolvedTiles[i] = vec4<f32>(f32(count), clamp(color, vec3<f32>(0.0), vec3<f32>(1.0)));
  resolvedTiles[i + tileCount] = vec4<f32>(clamp(local, vec2<f32>(0.0), vec2<f32>(1.0)), variance);
  resolvedTiles[i + tileCount * 2u] = vec4<f32>(covariance, 0.0, 0.0, 0.0);
}
`
}
