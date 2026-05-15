export function dragPointComputeWgsl (): string {
  return `
struct DragPointUniforms {
  mousePos: vec2<f32>,
  index: f32,
  pointCount: u32,
  textureSize: u32,
};

@group(0) @binding(0) var<uniform> dragPoint: DragPointUniforms;
@group(0) @binding(1) var previousPositions: texture_2d<f32>;
@group(0) @binding(2) var positionsOut: texture_storage_2d<rgba32float, write>;
@group(0) @binding(3) var<storage, read_write> positionsBuf: array<vec4<f32>>;

@compute @workgroup_size(64)
fn computeMain(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= dragPoint.pointCount) { return; }

  let col = i32(i % dragPoint.textureSize);
  let row = i32(i / dragPoint.textureSize);
  let coords = vec2<i32>(col, row);
  var pointPosition = textureLoad(previousPositions, coords, 0);

  if (dragPoint.index >= 0.0 && dragPoint.index == pointPosition.b) {
    pointPosition.r = dragPoint.mousePos.x;
    pointPosition.g = dragPoint.mousePos.y;
  }

  textureStore(positionsOut, coords, pointPosition);
  positionsBuf[i] = pointPosition;
}
`
}
