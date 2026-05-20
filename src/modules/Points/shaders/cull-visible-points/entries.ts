export const cullVisiblePointsEntriesWgsl = `
@compute @workgroup_size(64)
fn selectTileBudgetMain(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (cullUniforms.tileBudget == 0u) { return; }
  let visibility = evaluatePointVisibility(gid.x);
  if (visibility.keep == 0u) { return; }
  let slot = tileBudgetSlotForPoint(gid.x);
  if (slot >= cullUniforms.tileBudget || slot >= cullUniforms.tileBudgetSlots) { return; }
  let outIndex = visibility.tileIndex * cullUniforms.tileBudgetSlots + slot;
  _ = atomicMax(&tileBudgetPriorities[outIndex], visibility.priority);
}

@compute @workgroup_size(64)
fn countMain(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>,
  @builtin(workgroup_id) wid: vec3<u32>,
) {
  let localIndex = lid.x;
  let keep = select(0u, 1u, pointIsVisible(gid.x));
  if (gid.x < cullUniforms.pointCount) {
    visibleMask[gid.x] = keep;
  }
  localKeep[localIndex] = keep;
  workgroupBarrier();
  workgroupInclusiveScan(localIndex);

  if (localIndex == 0u) {
    visibleGroupOffsets[wid.x] = localKeep[63u];
  }
}

@compute @workgroup_size(64)
fn scatterMain(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>,
  @builtin(workgroup_id) wid: vec3<u32>,
) {
  let localIndex = lid.x;
  let inRange = gid.x < cullUniforms.pointCount;
  var keep = 0u;
  if (inRange) {
    keep = visibleMask[gid.x];
  }
  localKeep[localIndex] = keep;
  workgroupBarrier();
  workgroupInclusiveScan(localIndex);

  if (!inRange || keep == 0u) {
    return;
  }

  let localOffset = localKeep[localIndex] - 1u;
  visibleIndices[visibleGroupOffsets[wid.x] + localOffset] = gid.x;
}
`
