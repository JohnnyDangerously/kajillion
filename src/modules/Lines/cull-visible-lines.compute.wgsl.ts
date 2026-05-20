export function cullVisibleLinesComputeWgsl (): string {
  return `
struct CullLineUniforms {
  transformationMatrix: mat4x4<f32>,
  linkCount: u32,
  pointsTextureSize: f32,
  spaceSize: f32,
  screenSize: vec2<f32>,
  curvedLinkControlPointDistance: f32,
  renderPositionMix: f32,
  linkMinPixelLength: f32,
  linkLodStrength: f32,
  linkLodZoomRange: vec2<f32>,
  linkLodMinSampleRate: f32,
  hoveredLinkIndex: f32,
  focusedLinkIndex: f32,
};

@group(0) @binding(0) var<uniform> cullLineUniforms: CullLineUniforms;
@group(0) @binding(1) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> pointAArr: array<vec2<f32>>;
@group(0) @binding(3) var<storage, read> pointBArr: array<vec2<f32>>;
@group(0) @binding(4) var<storage, read_write> visibleIndices: array<u32>;
@group(0) @binding(5) var<storage, read_write> indirectArgs: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read> activeMask: array<u32>;
@group(0) @binding(7) var<storage, read> previousPositions: array<vec4<f32>>;

var<workgroup> localKeep: array<u32, 64>;
var<workgroup> localLinkIndices: array<u32, 64>;
var<workgroup> localBase: u32;

fn pointClip(point: vec2<f32>) -> vec2<f32> {
  var p = 2.0 * point / cullLineUniforms.spaceSize - vec2<f32>(1.0);
  p = p * (cullLineUniforms.spaceSize / cullLineUniforms.screenSize);
  return (cullLineUniforms.transformationMatrix * vec4<f32>(p, 1.0, 1.0)).xy;
}

fn hash01(index: u32) -> f32 {
  var x = index + 1u;
  x = (x ^ (x >> 16u)) * 0x7feb352du;
  x = (x ^ (x >> 15u)) * 0x846ca68bu;
  x = x ^ (x >> 16u);
  return f32(x & 0x00ffffffu) / 16777216.0;
}

fn linkLodWeight(scale: f32) -> f32 {
  let farScale = min(cullLineUniforms.linkLodZoomRange.x, cullLineUniforms.linkLodZoomRange.y);
  let nearScale = max(cullLineUniforms.linkLodZoomRange.x, cullLineUniforms.linkLodZoomRange.y);
  let overview = 1.0 - smoothstep(farScale, nearScale, scale);
  return clamp(cullLineUniforms.linkLodStrength, 0.0, 1.0) * overview;
}

@compute @workgroup_size(64)
fn computeMain(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>,
) {
  let linkIdx = gid.x;
  let localIndex = lid.x;
  var keep = false;

  if (linkIdx < cullLineUniforms.linkCount && activeMask[linkIdx] != 0u) {
    let textureSize = u32(cullLineUniforms.pointsTextureSize);
    let pointA = pointAArr[linkIdx];
    let pointB = pointBArr[linkIdx];
    let idxA = u32(pointA.y) * textureSize + u32(pointA.x);
    let idxB = u32(pointB.y) * textureSize + u32(pointB.x);
    var a: vec2<f32>;
    var b: vec2<f32>;
    if (cullLineUniforms.renderPositionMix >= 0.999) {
      a = positions[idxA].xy;
      b = positions[idxB].xy;
    } else {
      a = mix(previousPositions[idxA], positions[idxA], cullLineUniforms.renderPositionMix).xy;
      b = mix(previousPositions[idxB], positions[idxB], cullLineUniforms.renderPositionMix).xy;
    }
    let aClip = pointClip(a);
    let bClip = pointClip(b);

    let linkLenClip = length(bClip - aClip);
    let curveBulge = abs(cullLineUniforms.curvedLinkControlPointDistance) * linkLenClip;
    let margin = max(0.08, 0.15 + curveBulge);
    keep = !((aClip.x < -1.0 - margin && bClip.x < -1.0 - margin) ||
        (aClip.x > 1.0 + margin && bClip.x > 1.0 + margin) ||
        (aClip.y < -1.0 - margin && bClip.y < -1.0 - margin) ||
        (aClip.y > 1.0 + margin && bClip.y > 1.0 + margin));

    let scale = abs(cullLineUniforms.transformationMatrix[0][0]);
    let linkDistPx = length(b - a) * scale;
    if (cullLineUniforms.linkMinPixelLength > 0.0 && linkDistPx < cullLineUniforms.linkMinPixelLength) {
      keep = false;
    }

    let linkIndexFloat = f32(linkIdx);
    let isImportantLink = cullLineUniforms.hoveredLinkIndex == linkIndexFloat || cullLineUniforms.focusedLinkIndex == linkIndexFloat;
    let lodWeight = linkLodWeight(scale);
    if (keep && lodWeight > 0.0 && !isImportantLink) {
      let minSampleRate = clamp(cullLineUniforms.linkLodMinSampleRate, 0.02, 1.0);
      let sampleRate = mix(1.0, minSampleRate, lodWeight);
      let hSample = hash01(linkIdx + 37u);
      let feather = max(0.015, 0.14 * lodWeight * (1.0 - sampleRate));
      let sampleAlpha = 1.0 - smoothstep(sampleRate, min(1.0, sampleRate + feather), hSample);
      if (sampleAlpha <= 0.001) {
        keep = false;
      }
    }
  }

  localKeep[localIndex] = select(0u, 1u, keep);
  localLinkIndices[localIndex] = linkIdx;
  workgroupBarrier();

  if (localIndex == 0u) {
    var visibleCount = 0u;
    for (var j = 0u; j < 64u; j = j + 1u) {
      visibleCount = visibleCount + localKeep[j];
    }
    localBase = atomicAdd(&indirectArgs[1], visibleCount);
  }
  workgroupBarrier();

  if (localKeep[localIndex] == 0u) {
    return;
  }
  var localOffset = 0u;
  for (var j = 0u; j < localIndex; j = j + 1u) {
    localOffset = localOffset + localKeep[j];
  }
  visibleIndices[localBase + localOffset] = localLinkIndices[localIndex];
}
`
}
