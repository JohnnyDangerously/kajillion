export function prefixVisiblePointsComputeWgsl (): string {
  return `
const blockSize: u32 = 256u;

@group(0) @binding(0) var<storage, read_write> visibleGroupOffsets: array<u32>;
@group(0) @binding(1) var<storage, read_write> blockSums: array<u32>;
@group(0) @binding(2) var<storage, read_write> blockOffsets: array<u32>;
@group(0) @binding(3) var<storage, read_write> indirectArgs: array<atomic<u32>>;

var<workgroup> scanScratch: array<u32, 256>;

@compute @workgroup_size(256)
fn scanGroupsMain(
  @builtin(local_invocation_id) lid: vec3<u32>,
  @builtin(workgroup_id) wid: vec3<u32>,
) {
  let localIndex = lid.x;
  let groupIndex = wid.x * blockSize + localIndex;
  let groupCount = arrayLength(&visibleGroupOffsets);

  var value = 0u;
  if (groupIndex < groupCount) {
    value = visibleGroupOffsets[groupIndex];
  }
  scanScratch[localIndex] = value;
  workgroupBarrier();

  var offset = 1u;
  for (var step = 0u; step < 8u; step = step + 1u) {
    var addend = 0u;
    if (localIndex >= offset) {
      addend = scanScratch[localIndex - offset];
    }
    workgroupBarrier();
    scanScratch[localIndex] = scanScratch[localIndex] + addend;
    workgroupBarrier();
    offset = offset << 1u;
  }

  if (groupIndex < groupCount) {
    visibleGroupOffsets[groupIndex] = scanScratch[localIndex] - value;
  }
  if (localIndex == blockSize - 1u || groupIndex == groupCount - 1u) {
    blockSums[wid.x] = scanScratch[localIndex];
  }
}

@compute @workgroup_size(1)
fn scanBlocksMain() {
  let blockCount = arrayLength(&blockSums);
  var sum = 0u;
  for (var blockIndex = 0u; blockIndex < blockCount; blockIndex = blockIndex + 1u) {
    let count = blockSums[blockIndex];
    blockOffsets[blockIndex] = sum;
    sum = sum + count;
  }
  atomicStore(&indirectArgs[0], 4u);
  atomicStore(&indirectArgs[1], sum);
  atomicStore(&indirectArgs[2], 0u);
  atomicStore(&indirectArgs[3], 0u);
}

@compute @workgroup_size(256)
fn addBlockOffsetsMain(
  @builtin(global_invocation_id) gid: vec3<u32>,
) {
  let groupIndex = gid.x;
  if (groupIndex >= arrayLength(&visibleGroupOffsets)) {
    return;
  }
  visibleGroupOffsets[groupIndex] = visibleGroupOffsets[groupIndex] + blockOffsets[groupIndex / blockSize];
}
`
}
