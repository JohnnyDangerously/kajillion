export const cullVisiblePointsSharedWgsl = `
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
  pointLodStrength: f32,
  pointLodZoomRange: vec2<f32>,
  pointLodMinSampleRate: f32,
  pointLodSizeCompensation: f32,
  renderPositionMix: f32,
  activeMaskEnabled: f32,
  tileBudget: u32,
  tileBudgetSize: f32,
  tileBudgetColumns: u32,
  tileBudgetRows: u32,
  tileBudgetSlots: u32,
};

@group(0) @binding(0) var<uniform> cullUniforms: CullUniforms;
@group(0) @binding(1) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> sizes: array<f32>;
@group(0) @binding(3) var<storage, read_write> visibleIndices: array<u32>;
@group(0) @binding(4) var<storage, read_write> indirectArgs: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read> activeMask: array<u32>;
@group(0) @binding(6) var<storage, read> pointStatusBuf: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> visibleGroupOffsets: array<u32>;
@group(0) @binding(8) var<storage, read_write> visibleMask: array<u32>;
@group(0) @binding(9) var<storage, read> previousPositions: array<vec4<f32>>;
@group(0) @binding(10) var<storage, read_write> tileBudgetPriorities: array<atomic<u32>>;

const outlineRingScale: f32 = 1.3;
const maxTileBudgetSlots: u32 = 16u;
const priorityTieMask: u32 = 0x001fffffu;
const priorityScoreShift: u32 = 21u;
var<workgroup> localKeep: array<u32, 64>;

struct PointVisibility {
  keep: u32,
  tileIndex: u32,
  priority: u32,
};

fn workgroupInclusiveScan(localIndex: u32) {
  for (var offset = 1u; offset < 64u; offset = offset << 1u) {
    var addend = 0u;
    if (localIndex >= offset) {
      addend = localKeep[localIndex - offset];
    }
    workgroupBarrier();
    localKeep[localIndex] = localKeep[localIndex] + addend;
    workgroupBarrier();
  }
}

fn calculatePointSize(pointSize: f32) -> f32 {
  let scale = cullUniforms.transformationMatrix[0][0];
  var pSize: f32;
  if (cullUniforms.scalePointsOnZoom > 0.0) {
    pSize = pointSize * cullUniforms.ratio * scale;
  } else {
    pSize = pointSize * cullUniforms.ratio;
  }
  return min(pSize, cullUniforms.maxPointSize * cullUniforms.ratio);
}

fn hash01(index: u32) -> f32 {
  var x = index + 1u;
  x = (x ^ (x >> 16u)) * 0x7feb352du;
  x = (x ^ (x >> 15u)) * 0x846ca68bu;
  x = x ^ (x >> 16u);
  return f32(x & 0x00ffffffu) / 16777216.0;
}

fn hashU32(index: u32) -> u32 {
  var x = index + 1u;
  x = (x ^ (x >> 16u)) * 0x7feb352du;
  x = (x ^ (x >> 15u)) * 0x846ca68bu;
  x = x ^ (x >> 16u);
  return x;
}

fn pointLodWeight(scale: f32) -> f32 {
  let farScale = min(cullUniforms.pointLodZoomRange.x, cullUniforms.pointLodZoomRange.y);
  let nearScale = max(cullUniforms.pointLodZoomRange.x, cullUniforms.pointLodZoomRange.y);
  let overview = 1.0 - smoothstep(farScale, nearScale, scale);
  return clamp(cullUniforms.pointLodStrength, 0.0, 1.0) * overview;
}

fn screenPixelFromClip(centerClip: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(
    (centerClip.x * 0.5 + 0.5) * cullUniforms.screenSize.x * cullUniforms.ratio,
    (1.0 - (centerClip.y * 0.5 + 0.5)) * cullUniforms.screenSize.y * cullUniforms.ratio,
  );
}

fn tileIndexForPixel(pixel: vec2<f32>) -> u32 {
  if (cullUniforms.tileBudgetColumns == 0u || cullUniforms.tileBudgetRows == 0u || cullUniforms.tileBudgetSize <= 0.0) {
    return 0u;
  }
  let tileX = u32(clamp(floor(pixel.x / cullUniforms.tileBudgetSize), 0.0, f32(cullUniforms.tileBudgetColumns - 1u)));
  let tileY = u32(clamp(floor(pixel.y / cullUniforms.tileBudgetSize), 0.0, f32(cullUniforms.tileBudgetRows - 1u)));
  return tileY * cullUniforms.tileBudgetColumns + tileX;
}
`
