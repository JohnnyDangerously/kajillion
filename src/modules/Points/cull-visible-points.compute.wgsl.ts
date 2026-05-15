export function cullVisiblePointsComputeWgsl (): string {
  return `
struct CullUniforms {
  ratio: f32,
  transformationMatrix: mat4x4<f32>,
  pointCount: u32,
  spaceSize: f32,
  screenSize: vec2<f32>,
  sizeScale: f32,
  scalePointsOnZoom: f32,
  maxPointSize: f32,
  pointMinPixelSize: f32,
};

@group(0) @binding(0) var<uniform> cullUniforms: CullUniforms;
@group(0) @binding(1) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> sizes: array<f32>;
@group(0) @binding(3) var<storage, read_write> visibleIndices: array<u32>;
@group(0) @binding(4) var<storage, read_write> indirectArgs: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read> activeMask: array<u32>;

fn calculatePointSize(pointSize: f32) -> f32 {
  let scale = cullUniforms.transformationMatrix[0][0];
  var pSize: f32;
  if (cullUniforms.scalePointsOnZoom > 0.0) {
    pSize = pointSize * cullUniforms.ratio * scale;
  } else {
    pSize = pointSize * cullUniforms.ratio * min(5.0, max(1.0, scale * 0.01));
  }
  return min(pSize, cullUniforms.maxPointSize * cullUniforms.ratio);
}

@compute @workgroup_size(64)
fn computeMain(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= cullUniforms.pointCount) {
    return;
  }
  if (activeMask[i] == 0u) {
    return;
  }

  let point = positions[i].xy;
  var normalizedPosition = 2.0 * point / cullUniforms.spaceSize - vec2<f32>(1.0);
  normalizedPosition = normalizedPosition * (cullUniforms.spaceSize / cullUniforms.screenSize);
  let finalPosition = cullUniforms.transformationMatrix * vec4<f32>(normalizedPosition, 1.0, 1.0);
  let centerClip = finalPosition.xy;

  let pointSize = calculatePointSize(sizes[i] * cullUniforms.sizeScale);
  if (cullUniforms.pointMinPixelSize > 0.0 && pointSize < cullUniforms.pointMinPixelSize) {
    return;
  }

  // Use the actual sprite size for the frustum margin. This avoids keeping
  // every near-edge point alive just because the device supports a large
  // maxPointSize.
  let cullMargin = 2.0 * vec2<f32>(pointSize) / (cullUniforms.screenSize * cullUniforms.ratio);
  if (abs(centerClip.x) > 1.0 + cullMargin.x || abs(centerClip.y) > 1.0 + cullMargin.y) {
    return;
  }

  let slot = atomicAdd(&indirectArgs[1], 1u);
  visibleIndices[slot] = i;
}
`
}
