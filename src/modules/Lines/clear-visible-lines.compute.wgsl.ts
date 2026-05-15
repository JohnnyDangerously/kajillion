export function clearVisibleLinesComputeWgsl (): string {
  return `
struct ClearLineUniforms {
  vertexCount: u32,
};

@group(0) @binding(0) var<uniform> clearLineUniforms: ClearLineUniforms;
@group(0) @binding(1) var<storage, read_write> indirectArgs: array<atomic<u32>>;

@compute @workgroup_size(1)
fn computeMain() {
  atomicStore(&indirectArgs[0], clearLineUniforms.vertexCount);
  atomicStore(&indirectArgs[1], 0u);
  atomicStore(&indirectArgs[2], 0u);
  atomicStore(&indirectArgs[3], 0u);
}
`
}
