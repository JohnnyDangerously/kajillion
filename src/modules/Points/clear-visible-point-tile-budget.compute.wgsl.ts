export function clearVisiblePointTileBudgetComputeWgsl (): string {
  return `
@group(0) @binding(0) var<storage, read_write> tileBudgetPriorities: array<atomic<u32>>;

@compute @workgroup_size(64)
fn computeMain(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= arrayLength(&tileBudgetPriorities)) {
    return;
  }
  atomicStore(&tileBudgetPriorities[i], 0u);
}
`
}
