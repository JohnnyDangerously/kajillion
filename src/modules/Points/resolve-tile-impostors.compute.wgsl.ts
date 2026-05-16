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

@compute @workgroup_size(64)
fn computeMain(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let tileCount = tileUniforms.tileColumns * tileUniforms.tileRows;
  if (i >= tileCount) { return; }

  let count = atomicLoad(&atomicTiles[i].count);
  if (count == 0u) {
    resolvedTiles[i] = vec4<f32>(0.0);
    resolvedTiles[i + tileCount] = vec4<f32>(0.0);
    resolvedTiles[i + tileCount * 2u] = vec4<f32>(0.0);
    return;
  }

  let denom = f32(count * tileUniforms.colorScale);
  let positionDenom = f32(count * tileUniforms.positionScale);
  let color = vec3<f32>(
    f32(atomicLoad(&atomicTiles[i].r)) / denom,
    f32(atomicLoad(&atomicTiles[i].g)) / denom,
    f32(atomicLoad(&atomicTiles[i].b)) / denom,
  );
  let local = vec2<f32>(
    f32(atomicLoad(&atomicTiles[i].x)) / positionDenom,
    f32(atomicLoad(&atomicTiles[i].y)) / positionDenom,
  );
  let secondMoment = vec3<f32>(
    f32(atomicLoad(&atomicTiles[i].xx)) / positionDenom,
    f32(atomicLoad(&atomicTiles[i].yy)) / positionDenom,
    f32(atomicLoad(&atomicTiles[i].xy)) / positionDenom,
  );
  let variance = max(secondMoment.xy - local * local, vec2<f32>(0.0012));
  let covariance = clamp(secondMoment.z - local.x * local.y, -0.18, 0.18);
  resolvedTiles[i] = vec4<f32>(f32(count), clamp(color, vec3<f32>(0.0), vec3<f32>(1.0)));
  resolvedTiles[i + tileCount] = vec4<f32>(clamp(local, vec2<f32>(0.0), vec2<f32>(1.0)), variance);
  resolvedTiles[i + tileCount * 2u] = vec4<f32>(covariance, 0.0, 0.0, 0.0);
}
`
}
