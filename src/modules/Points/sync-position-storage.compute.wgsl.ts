// Sync currentPositionTexture → positionStorageBuffer via a compute pass.
//
// Why this exists: WebGPU's commandEncoder.copyTextureToBuffer requires
// `bytesPerRow` to be a multiple of 256 (COPY_BYTES_PER_ROW_ALIGNMENT).
// kajillion's positionStorageBuffer is allocated tightly packed
// (pointsTextureSize * pointsTextureSize * 16 bytes, NOT row-padded), so
// a direct copyTextureToBuffer with bytesPerRow=size*16 fails WebGPU
// validation silently for any size where size*16 isn't a multiple of 256.
// The buffer never gets updated, the vertex shaders that read positions
// via `positions[instanceIdx]` keep reading the initial seed forever, and
// every rendered point sits at its generateBA starting coordinate while
// the GPU simulation cheerfully moves currentPositionTexture without
// anyone reading the result. We discovered this after every "WebGPU sim"
// number in benchmarks was actually measuring the cost of redrawing a
// frozen scatter cloud.
//
// A compute pass has none of the row-alignment requirements: each thread
// reads one texel via textureLoad and writes one vec4 into the buffer at
// the matching packed offset. One workgroup dispatch per sim tick, ~0.1 ms
// at n=1M — much cheaper than the slow alternative of either reallocating
// the buffer with padded rows or sampling currentPositionTexture from
// every vertex shader.

export function syncPositionStorageWgsl (): string {
  return `
struct SyncUniforms {
  pointCount: u32,
  textureSize: u32,
};

@group(0) @binding(0) var<uniform> sync: SyncUniforms;
@group(0) @binding(1) var positionsTexture: texture_2d<f32>;
@group(0) @binding(2) var<storage, read_write> positionsBuf: array<vec4<f32>>;

@compute @workgroup_size(64)
fn computeMain(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= sync.pointCount) { return; }
  let col = i32(i % sync.textureSize);
  let row = i32(i / sync.textureSize);
  positionsBuf[i] = textureLoad(positionsTexture, vec2<i32>(col, row), 0);
}
`
}
