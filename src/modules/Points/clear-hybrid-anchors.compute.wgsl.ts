export function clearHybridAnchorsComputeWgsl (): string {
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
@group(0) @binding(1) var<storage, read_write> anchorCounts: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> anchorPositions: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> anchorColors: array<vec4<f32>>;

@compute @workgroup_size(64)
fn computeMain(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let tileCount = anchorUniforms.tileColumns * anchorUniforms.tileRows;
  let anchorCapacity = tileCount * anchorUniforms.anchorsPerTile;
  if (i < anchorCapacity) {
    atomicStore(&anchorCounts[i], 0u);
  }
  if (i < anchorCapacity) {
    anchorPositions[i] = vec4<f32>(2.0, 2.0, 0.0, 0.0);
    anchorColors[i] = vec4<f32>(0.0);
  }
}
`
}
