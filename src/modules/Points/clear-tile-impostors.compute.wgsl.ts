export function clearTileImpostorsComputeWgsl (): string {
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
  atomicStore(&atomicTiles[i].count, 0u);
  atomicStore(&atomicTiles[i].r, 0u);
  atomicStore(&atomicTiles[i].g, 0u);
  atomicStore(&atomicTiles[i].b, 0u);
  atomicStore(&atomicTiles[i].x, 0u);
  atomicStore(&atomicTiles[i].y, 0u);
  atomicStore(&atomicTiles[i].xx, 0u);
  atomicStore(&atomicTiles[i].yy, 0u);
  atomicStore(&atomicTiles[i].xy, 0u);
  resolvedTiles[i] = vec4<f32>(0.0);
  resolvedTiles[i + tileCount] = vec4<f32>(0.0);
  resolvedTiles[i + tileCount * 2u] = vec4<f32>(0.0);
}
`
}
