export function materializeHybridAnchorsComputeWgsl (): string {
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
@group(0) @binding(5) var<storage, read_write> anchorPriorities: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read_write> anchorPositions: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> anchorColors: array<vec4<f32>>;
@group(0) @binding(8) var<storage, read_write> anchorIndirectArgs: array<atomic<u32>>;

const PRIORITY_TIE_MASK: u32 = 0x001fffffu;

fn projectPoint(point: vec2<f32>) -> vec2<f32> {
  var normalizedPosition = 2.0 * point / anchorUniforms.spaceSize - vec2<f32>(1.0);
  normalizedPosition = normalizedPosition * (anchorUniforms.spaceSize / anchorUniforms.screenSize);
  let finalPosition = anchorUniforms.transformationMatrix * vec4<f32>(normalizedPosition, 1.0, 1.0);
  return finalPosition.xy;
}

@compute @workgroup_size(64)
fn computeMain(@builtin(global_invocation_id) gid: vec3<u32>) {
  let anchorIndex = gid.x;
  let tileCountTotal = anchorUniforms.tileColumns * anchorUniforms.tileRows;
  let anchorCapacity = tileCountTotal * anchorUniforms.anchorsPerTile;
  if (anchorIndex >= anchorCapacity) { return; }

  let priority = atomicLoad(&anchorPriorities[anchorCapacity + anchorIndex]);
  if (priority == 0u) { return; }

  let pointIndex = PRIORITY_TIE_MASK - (priority & PRIORITY_TIE_MASK);
  if (pointIndex >= anchorUniforms.pointCount) { return; }

  let tileIndex = anchorIndex / anchorUniforms.anchorsPerTile;
  let tileCount = resolvedTiles[tileIndex].x;
  if (tileCount <= 0.0) { return; }

  let sparse = tileCount <= anchorUniforms.sparseTileThreshold;
  let clip = projectPoint(positions[pointIndex].xy);
  let signedTileCount = select(-tileCount, tileCount, sparse);
  anchorPositions[anchorIndex] = vec4<f32>(clip, sizes[pointIndex], signedTileCount);
  anchorColors[anchorIndex] = colors[pointIndex];
  let visibleIndex = atomicAdd(&anchorIndirectArgs[1], 1u);
  atomicStore(&anchorPriorities[visibleIndex], anchorIndex);
}
`
}
