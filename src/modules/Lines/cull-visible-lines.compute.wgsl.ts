export function cullVisibleLinesComputeWgsl (): string {
  return `
struct CullLineUniforms {
  transformationMatrix: mat4x4<f32>,
  linkCount: u32,
  pointsTextureSize: f32,
  spaceSize: f32,
  screenSize: vec2<f32>,
  curvedLinkControlPointDistance: f32,
};

@group(0) @binding(0) var<uniform> cullLineUniforms: CullLineUniforms;
@group(0) @binding(1) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> pointAArr: array<vec2<f32>>;
@group(0) @binding(3) var<storage, read> pointBArr: array<vec2<f32>>;
@group(0) @binding(4) var<storage, read_write> visibleIndices: array<u32>;
@group(0) @binding(5) var<storage, read_write> indirectArgs: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read> activeMask: array<u32>;

fn pointClip(point: vec2<f32>) -> vec2<f32> {
  var p = 2.0 * point / cullLineUniforms.spaceSize - vec2<f32>(1.0);
  p = p * (cullLineUniforms.spaceSize / cullLineUniforms.screenSize);
  return (cullLineUniforms.transformationMatrix * vec4<f32>(p, 1.0, 1.0)).xy;
}

@compute @workgroup_size(64)
fn computeMain(@builtin(global_invocation_id) gid: vec3<u32>) {
  let linkIdx = gid.x;
  if (linkIdx >= cullLineUniforms.linkCount) {
    return;
  }
  if (activeMask[linkIdx] == 0u) {
    return;
  }

  let textureSize = u32(cullLineUniforms.pointsTextureSize);
  let pointA = pointAArr[linkIdx];
  let pointB = pointBArr[linkIdx];
  let idxA = u32(pointA.y) * textureSize + u32(pointA.x);
  let idxB = u32(pointB.y) * textureSize + u32(pointB.x);
  let aClip = pointClip(positions[idxA].xy);
  let bClip = pointClip(positions[idxB].xy);

  let linkLenClip = length(bClip - aClip);
  let curveBulge = abs(cullLineUniforms.curvedLinkControlPointDistance) * linkLenClip;
  let margin = max(0.08, 0.15 + curveBulge);
  if ((aClip.x < -1.0 - margin && bClip.x < -1.0 - margin) ||
      (aClip.x > 1.0 + margin && bClip.x > 1.0 + margin) ||
      (aClip.y < -1.0 - margin && bClip.y < -1.0 - margin) ||
      (aClip.y > 1.0 + margin && bClip.y > 1.0 + margin)) {
    return;
  }

  let slot = atomicAdd(&indirectArgs[1], 1u);
  visibleIndices[slot] = linkIdx;
}
`
}
