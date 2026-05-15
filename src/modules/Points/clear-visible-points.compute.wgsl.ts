export function clearVisiblePointsComputeWgsl (): string {
  return `
@group(0) @binding(0) var<storage, read_write> indirectArgs: array<atomic<u32>>;

@compute @workgroup_size(1)
fn computeMain() {
  atomicStore(&indirectArgs[0], 4u);
  atomicStore(&indirectArgs[1], 0u);
  atomicStore(&indirectArgs[2], 0u);
  atomicStore(&indirectArgs[3], 0u);
}
`
}
