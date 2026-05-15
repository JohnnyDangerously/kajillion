export function updatePositionComputeWgsl (): string {
  return `
struct UpdatePositionUniforms {
  friction: f32,
  spaceSize: f32,
  pointCount: u32,
  textureSize: u32,
};

@group(0) @binding(0) var<uniform> updatePosition: UpdatePositionUniforms;
@group(0) @binding(1) var previousPositions: texture_2d<f32>;
@group(0) @binding(2) var velocity: texture_2d<f32>;
@group(0) @binding(3) var pinnedStatusTexture: texture_2d<f32>;
@group(0) @binding(4) var positionsOut: texture_storage_2d<rgba32float, write>;
@group(0) @binding(5) var<storage, read_write> positionsBuf: array<vec4<f32>>;

@compute @workgroup_size(64)
fn computeMain(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= updatePosition.pointCount) { return; }

  let col = i32(i % updatePosition.textureSize);
  let row = i32(i / updatePosition.textureSize);
  let coords = vec2<i32>(col, row);

  var pointPosition = textureLoad(previousPositions, coords, 0);
  let pointVelocity = textureLoad(velocity, coords, 0);
  let pinnedStatus = textureLoad(pinnedStatusTexture, coords, 0);

  if (pinnedStatus.r <= 0.5) {
    let v = pointVelocity.rg * updatePosition.friction;
    pointPosition.r = clamp(pointPosition.r + v.r, 0.0, updatePosition.spaceSize);
    pointPosition.g = clamp(pointPosition.g + v.g, 0.0, updatePosition.spaceSize);
  }

  textureStore(positionsOut, coords, pointPosition);
  positionsBuf[i] = pointPosition;
}
`
}
