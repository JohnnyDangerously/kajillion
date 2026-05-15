export function fillHybridAnchorsComputeWgsl (): string {
  return `
struct HybridAnchorBuildUniforms {
  ratio: f32,
  transformationMatrix: mat4x4<f32>,
  spaceSize: f32,
  screenSize: vec2<f32>,
  tileSize: f32,
  pointCount: u32,
  tileColumns: u32,
  tileRows: u32,
  anchorsPerTile: u32,
  denseSampleRate: f32,
  sparseTileThreshold: f32,
};

@group(0) @binding(0) var<uniform> anchorUniforms: HybridAnchorBuildUniforms;
@group(0) @binding(1) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> colors: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> sizes: array<f32>;
@group(0) @binding(4) var<storage, read> resolvedTiles: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> anchorCounts: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read_write> anchorPositions: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> anchorColors: array<vec4<f32>>;

fn hash01(index: u32) -> f32 {
  var x = index + 1u;
  x = (x ^ (x >> 16u)) * 0x7feb352du;
  x = (x ^ (x >> 15u)) * 0x846ca68bu;
  x = x ^ (x >> 16u);
  return f32(x & 0x00ffffffu) / 16777216.0;
}

fn projectPoint(point: vec2<f32>) -> vec2<f32> {
  var normalizedPosition = 2.0 * point / anchorUniforms.spaceSize - vec2<f32>(1.0);
  normalizedPosition = normalizedPosition * (anchorUniforms.spaceSize / anchorUniforms.screenSize);
  let finalPosition = anchorUniforms.transformationMatrix * vec4<f32>(normalizedPosition, 1.0, 1.0);
  return finalPosition.xy;
}

@compute @workgroup_size(64)
fn computeMain(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= anchorUniforms.pointCount) { return; }

  let clip = projectPoint(positions[i].xy);
  if (abs(clip.x) > 1.02 || abs(clip.y) > 1.02) { return; }

  let pixel = vec2<f32>(
    (clip.x * 0.5 + 0.5) * anchorUniforms.screenSize.x * anchorUniforms.ratio,
    (1.0 - (clip.y * 0.5 + 0.5)) * anchorUniforms.screenSize.y * anchorUniforms.ratio,
  );
  let tileX = u32(clamp(floor(pixel.x / anchorUniforms.tileSize), 0.0, f32(anchorUniforms.tileColumns - 1u)));
  let tileY = u32(clamp(floor(pixel.y / anchorUniforms.tileSize), 0.0, f32(anchorUniforms.tileRows - 1u)));
  let tileIndex = tileY * anchorUniforms.tileColumns + tileX;
  let tileCount = resolvedTiles[tileIndex].x;
  if (tileCount <= 0.0) { return; }

  let sparse = tileCount <= anchorUniforms.sparseTileThreshold;
  if (!sparse && hash01(i) > anchorUniforms.denseSampleRate) { return; }

  let slot = atomicAdd(&anchorCounts[tileIndex], 1u);
  if (slot >= anchorUniforms.anchorsPerTile) { return; }

  let outIndex = tileIndex * anchorUniforms.anchorsPerTile + slot;
  let signedTileCount = select(-tileCount, tileCount, sparse);
  anchorPositions[outIndex] = vec4<f32>(clip, sizes[i], signedTileCount);
  anchorColors[outIndex] = colors[i];
}
`
}
