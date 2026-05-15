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

fn projectPoint(point: vec2<f32>) -> vec2<f32> {
  var normalizedPosition = 2.0 * point / tileUniforms.spaceSize - vec2<f32>(1.0);
  normalizedPosition = normalizedPosition * (tileUniforms.spaceSize / tileUniforms.screenSize);
  let finalPosition = tileUniforms.transformationMatrix * vec4<f32>(normalizedPosition, 1.0, 1.0);
  return finalPosition.xy;
}

@compute @workgroup_size(64)
fn computeMain(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= tileUniforms.pointCount) { return; }

  let clip = projectPoint(positions[i].xy);
  if (abs(clip.x) > 1.0 || abs(clip.y) > 1.0) { return; }

  let pixel = vec2<f32>(
    (clip.x * 0.5 + 0.5) * tileUniforms.screenSize.x * tileUniforms.ratio,
    (1.0 - (clip.y * 0.5 + 0.5)) * tileUniforms.screenSize.y * tileUniforms.ratio,
  );
  let tileX = u32(clamp(floor(pixel.x / tileUniforms.tileSize), 0.0, f32(tileUniforms.tileColumns - 1u)));
  let tileY = u32(clamp(floor(pixel.y / tileUniforms.tileSize), 0.0, f32(tileUniforms.tileRows - 1u)));
  let tileIndex = tileY * tileUniforms.tileColumns + tileX;

  let colorScale = f32(tileUniforms.colorScale);
  let positionScale = f32(tileUniforms.positionScale);
  let tileOrigin = vec2<f32>(f32(tileX), f32(tileY)) * tileUniforms.tileSize;
  let local = clamp((pixel - tileOrigin) / tileUniforms.tileSize, vec2<f32>(0.0), vec2<f32>(1.0));
  let color = clamp(colors[i], vec4<f32>(0.0), vec4<f32>(1.0));
  atomicAdd(&atomicTiles[tileIndex].count, 1u);
  atomicAdd(&atomicTiles[tileIndex].r, u32(round(color.r * colorScale)));
  atomicAdd(&atomicTiles[tileIndex].g, u32(round(color.g * colorScale)));
  atomicAdd(&atomicTiles[tileIndex].b, u32(round(color.b * colorScale)));
  atomicAdd(&atomicTiles[tileIndex].x, u32(round(local.x * positionScale)));
  atomicAdd(&atomicTiles[tileIndex].y, u32(round(local.y * positionScale)));
  atomicAdd(&atomicTiles[tileIndex].xx, u32(round(local.x * local.x * positionScale)));
  atomicAdd(&atomicTiles[tileIndex].yy, u32(round(local.y * local.y * positionScale)));
  atomicAdd(&atomicTiles[tileIndex].xy, u32(round(local.x * local.y * positionScale)));
}
`
}
