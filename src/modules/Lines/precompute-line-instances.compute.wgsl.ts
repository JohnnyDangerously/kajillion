// WebGPU per-instance pre-pass for line rendering — SCAFFOLDING ONLY.
//
// Status: WGSL is complete and reviewed for correctness against the legacy
// vertex shader's instance-uniform math (see draw-curve-line.wgsl,
// `vertexMain` lines 115–248). NOT YET WIRED to the engine — the
// integration work (convert the six per-instance vertex buffers to
// dual-usage VERTEX|STORAGE, create a luma.gl ComputePipeline + storage
// buffer, dispatch one workgroup of 64 per ~64 links before the visible
// canvas render pass, swap the visible-pass vertex shader to read packed
// LineInstance entries by @builtin(instance_index)) is left for the next
// session. Both visible (drawCurveCommand) and picking (drawCurveIndexCommand)
// paths share the same WGSL file today, so the integration also needs to
// split or special-case the picking variant.
//
// Why land scaffolding: the WGSL design + std430 layout + per-binding
// indexing scheme are the load-bearing pieces. The Lines/index.ts wiring
// is mechanical from there.
//
// The fragment-rasterization vertex shader (draw-curve-line.wgsl) does
// ~16 instance-uniform computations 4× per quad (4 vertices × 300k links
// = 1.2M vertex invocations at n=100k): positions lookups, frustum
// transform, perpendicular basis, linkWidth/arrow/opacity calc,
// linkStatus texture sample, hover/focus color overrides. None of these
// depend on the per-vertex quad corner — they're identical across all
// four vertices of an instance.
//
// This compute pass does them once per link (300k threads instead of
// 1.2M) and writes the result into a packed LineInstance storage buffer.
// The render-side vertex shader becomes thin: read the precomputed state
// indexed by @builtin(instance_index), then only the actually-per-vertex
// work (conic Bezier eval at t = position.x, perpendicular offset by
// linkWidthPx × position.y, final mat4 transform to clip space) runs in
// the 4× hot path.
//
// Memory: 80 B per instance × 300k = ~24 MB at the bench dataset. Cheap.
//
// Layout must mirror the WGSL struct in draw-curve-line.wgsl exactly,
// including padding for vec2/vec4 alignment.
export const lineInstanceStructWgsl = `
struct LineInstance {
  // World-space positions resolved from points texture, snapped to vec4
  // alignment (.zw unused; left as 0 for future expansion).
  a: vec4<f32>,
  b: vec4<f32>,
  // Curve control point + curvedWeight packed in .zw (.z = w, .w unused).
  controlPoint: vec4<f32>,
  // .xy = curved-perp at t=0.5 (used for the straight-line case; the
  // curved case recomputes per-vertex anyway). .zw = full color, post-
  // opacity, post-greyout, post-hover-override.
  yBasisPad: vec4<f32>,
  rgbaColor: vec4<f32>,
  // Scalars packed into vec4 slots to keep std430 alignment simple.
  // .x = linkWidthPx (post hover/focus increment + post smoothing pad)
  // .y = smoothing (smoothingPx / linkWidthPx ratio passed to fragment)
  // .z = arrowLength (per-curve fraction)
  // .w = useArrow flag (0.0 or 1.0)
  widthSmoothingArrow: vec4<f32>,
  // .x = arrowWidthFactor (fragment uses it for the body/arrow blend)
  // .y = linkIndex (kept here for the picking path; same value as the
  //      legacy per-instance attribute)
  // .z = culled flag (1.0 = vertex shader emits degenerate offscreen
  //      position; 0.0 = draw normally)
  // .w = reserved
  arrowFactorIndexCulled: vec4<f32>,
};
`

export const lineInstanceStorageBindingsWgsl = `
@group(0) @binding(0) var<uniform> drawLine: DrawLineUniforms;
@group(0) @binding(1) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> pointAB: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> colorIn: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> widthArrowIndex: array<vec4<f32>>;
@group(0) @binding(5) var linkStatus: texture_2d<f32>;
@group(0) @binding(6) var linkStatusSampler: sampler;
@group(0) @binding(7) var<storage, read_write> instances: array<LineInstance>;
`

// Uniforms block must match the visible-pass uniforms struct (see
// draw-curve-line.wgsl). Kept in sync via copy/paste because WGSL has no
// `#include`.
export const drawLineUniformsStructWgsl = `
struct DrawLineUniforms {
  transformationMatrix: mat4x4<f32>,
  pointsTextureSize: f32,
  widthScale: f32,
  linkArrowsSizeScale: f32,
  spaceSize: f32,
  screenSize: vec2<f32>,
  linkVisibilityDistanceRange: vec2<f32>,
  linkVisibilityMinTransparency: f32,
  linkOpacity: f32,
  greyoutOpacity: f32,
  curvedWeight: f32,
  curvedLinkControlPointDistance: f32,
  curvedLinkSegments: f32,
  scaleLinksOnZoom: f32,
  maxPointSize: f32,
  renderMode: f32,
  hoveredLinkIndex: f32,
  hoveredLinkColor: vec4<f32>,
  hoveredLinkWidthIncrease: f32,
  isLinkHighlightingActive: f32,
  linkStatusTextureSize: f32,
  focusedLinkIndex: f32,
  focusedLinkWidthIncrease: f32,
  linkMinPixelLength: f32,
};
`

export function precomputeLineInstancesWgsl (): string {
  return `
${drawLineUniformsStructWgsl}
${lineInstanceStructWgsl}
${lineInstanceStorageBindingsWgsl}

fn map(value: f32, min1: f32, max1: f32, min2: f32, max2: f32) -> f32 {
  return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
}

fn calculateLinkWidthPx(widthIn: f32) -> f32 {
  let scale = drawLine.transformationMatrix[0][0];
  if (drawLine.scaleLinksOnZoom > 0.0) {
    var linkWidth = widthIn * drawLine.widthScale * scale;
    return linkWidth;
  } else {
    var w = widthIn / scale;
    w = w * min(5.0, max(1.0, scale * 0.01));
    return w * drawLine.widthScale * scale;
  }
}

@compute @workgroup_size(64, 1, 1)
fn computeMain(@builtin(global_invocation_id) gid: vec3<u32>) {
  let linkIdx = gid.x;
  let linkCount = arrayLength(&instances);
  if (linkIdx >= linkCount) {
    return;
  }

  // Per-instance inputs were per-attribute on the legacy vertex path;
  // here we pull them from packed storage buffers indexed by linkIdx.
  let endpointTexCoords = pointAB[linkIdx]; // .xy = pointA texcoord, .zw = pointB texcoord
  let inColor = colorIn[linkIdx];
  let widthArrowIndexEntry = widthArrowIndex[linkIdx];
  let widthIn = widthArrowIndexEntry.x;
  let arrowIn = widthArrowIndexEntry.y;
  let linkIndexIn = widthArrowIndexEntry.z;

  // Vertex-pull positions out of the storage buffer (same layout as the
  // visible-pass vertex shader: row-major matching the points texture).
  let textureSize = u32(drawLine.pointsTextureSize);
  let idxA = u32(endpointTexCoords.y) * textureSize + u32(endpointTexCoords.x);
  let idxB = u32(endpointTexCoords.w) * textureSize + u32(endpointTexCoords.z);
  let pointPositionA = positions[idxA];
  let pointPositionB = positions[idxB];
  let a = pointPositionA.xy;
  let b = pointPositionB.xy;

  var out: LineInstance;
  out.a = vec4<f32>(a, 0.0, 0.0);
  out.b = vec4<f32>(b, 0.0, 0.0);

  // Frustum cull. Both endpoints off the same screen edge ⇒ degenerate.
  let aNorm = (2.0 * a / drawLine.spaceSize - vec2<f32>(1.0)) * (drawLine.spaceSize / drawLine.screenSize);
  let bNorm = (2.0 * b / drawLine.spaceSize - vec2<f32>(1.0)) * (drawLine.spaceSize / drawLine.screenSize);
  let aNDC = (drawLine.transformationMatrix * vec4<f32>(aNorm, 1.0, 1.0)).xy;
  let bNDC = (drawLine.transformationMatrix * vec4<f32>(bNorm, 1.0, 1.0)).xy;
  let m: f32 = 0.15;
  var culled: f32 = 0.0;
  if ((aNDC.x < -1.0 - m && bNDC.x < -1.0 - m) ||
      (aNDC.x > 1.0 + m && bNDC.x > 1.0 + m) ||
      (aNDC.y < -1.0 - m && bNDC.y < -1.0 - m) ||
      (aNDC.y > 1.0 + m && bNDC.y > 1.0 + m)) {
    culled = 1.0;
  }

  let xBasis = b - a;
  let linkDist = length(xBasis);
  let invLinkDist = select(0.0, 1.0 / linkDist, linkDist > 0.0);
  let yBasis = vec2<f32>(-xBasis.y, xBasis.x) * invLinkDist;
  let h = drawLine.curvedLinkControlPointDistance;
  let controlPoint = (a + b) * 0.5 + yBasis * linkDist * h;
  out.controlPoint = vec4<f32>(controlPoint, drawLine.curvedWeight, 0.0);
  out.yBasisPad = vec4<f32>(yBasis, 0.0, 0.0);

  let scale = drawLine.transformationMatrix[0][0];
  let linkDistPx = linkDist * scale;
  if (drawLine.linkMinPixelLength > 0.0 && linkDistPx < drawLine.linkMinPixelLength) {
    culled = 1.0;
  }

  let linkWidth = widthIn * drawLine.widthScale;
  let kArrow: f32 = 2.0;
  var arrowWidth = linkWidth * kArrow * drawLine.linkArrowsSizeScale;
  let arrowWidthDifference = max(0.0, arrowWidth - linkWidth);

  // Width path matches the legacy vertex shader's calculateArrowWidth
  // for non-zoom-scaled mode (the default we care about for perf).
  var arrowWidthPx: f32;
  if (drawLine.scaleLinksOnZoom > 0.0) {
    arrowWidthPx = arrowWidth;
  } else {
    var aw = arrowWidth / scale;
    aw = aw * min(5.0, max(1.0, scale * 0.01));
    arrowWidthPx = aw;
  }

  let arrowLength = min(0.3, (0.866 * arrowWidthPx * 2.0) / max(linkDist, 1e-6));

  var effectiveWidth = linkWidth;
  if (arrowIn > 0.5) {
    effectiveWidth = effectiveWidth + arrowWidthDifference;
  }
  let arrowWidthFactor = arrowWidthDifference / max(effectiveWidth, 1e-6);

  var linkWidthPx = calculateLinkWidthPx(effectiveWidth);
  let isPickPass = drawLine.renderMode > 0.0;
  if (isPickPass) {
    // 5px hover-detection padding on the index pass. The visible canvas
    // pass doesn't apply this — handled below.
    linkWidthPx = linkWidthPx + 5.0 / scale;
  }
  if (drawLine.hoveredLinkIndex == linkIndexIn) {
    linkWidthPx = linkWidthPx + drawLine.hoveredLinkWidthIncrease / scale;
  }
  if (drawLine.focusedLinkIndex == linkIndexIn) {
    linkWidthPx = linkWidthPx + drawLine.focusedLinkWidthIncrease / scale;
  }
  let smoothingPx = 0.5 / scale;
  let smoothing = smoothingPx / max(linkWidthPx, 1e-6);
  linkWidthPx = linkWidthPx + smoothingPx;

  out.widthSmoothingArrow = vec4<f32>(linkWidthPx, smoothing, arrowLength, arrowIn);
  out.arrowFactorIndexCulled = vec4<f32>(arrowWidthFactor, linkIndexIn, culled, 0.0);

  // Color: distance fade, greyout, hover override. Identical to the
  // visible-pass vertex shader's color path so the rendered output matches.
  let rgbColor = inColor.rgb;
  var opacity = inColor.a * drawLine.linkOpacity * max(
    drawLine.linkVisibilityMinTransparency,
    map(linkDistPx, drawLine.linkVisibilityDistanceRange.y, drawLine.linkVisibilityDistanceRange.x, 0.0, 1.0),
  );

  if (drawLine.isLinkHighlightingActive > 0.0 && drawLine.linkStatusTextureSize > 0.0) {
    let statusTexSize = drawLine.linkStatusTextureSize;
    let texX = linkIndexIn - statusTexSize * floor(linkIndexIn / statusTexSize);
    let texY = floor(linkIndexIn / statusTexSize);
    let linkStatusCoord = (vec2<f32>(texX, texY) + vec2<f32>(0.5)) / statusTexSize;
    let linkStatusValue = textureSampleLevel(linkStatus, linkStatusSampler, linkStatusCoord, 0.0);
    if (linkStatusValue.r > 0.0) {
      opacity = opacity * drawLine.greyoutOpacity;
    }
  }

  var rgbaColor = vec4<f32>(rgbColor, opacity);
  if (drawLine.hoveredLinkIndex == linkIndexIn && drawLine.hoveredLinkColor.a > -0.5) {
    rgbaColor = vec4<f32>(drawLine.hoveredLinkColor.rgb, rgbaColor.a * drawLine.hoveredLinkColor.a);
  }
  out.rgbaColor = rgbaColor;

  instances[linkIdx] = out;
}
`
}
