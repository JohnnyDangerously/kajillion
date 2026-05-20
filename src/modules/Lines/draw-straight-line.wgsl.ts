import { composeLineDrawShaderWgsl } from '@/graph/modules/Lines/shaders/line-draw-source.wgsl'

const straightLineIntroWgsl = `// Straight-link WebGPU draw path for curvedLinks=false.
//
// The curved shader supports rational Bezier ribbons even when host config
// collapses curvedLinkSegments to 1. At large edge counts that still leaves
// unnecessary conic-curve math in the vertex path. This shader preserves the
// same bindings, uniforms, attributes, fragment behavior, and picking mode,
// but expands each link as a simple screen-facing ribbon between endpoints.`

const straightLineHelpersWgsl = `
fn softLaneOffset(a: vec2<f32>, b: vec2<f32>, yBasis: vec2<f32>, linkIndex: f32, t: f32) -> vec2<f32> {
  if (drawLine.linkBundlingStrength <= 0.0) {
    return vec2<f32>(0.0);
  }

  let xBasis = b - a;
  let linkDist = length(xBasis);
  if (linkDist <= 1e-6) {
    return vec2<f32>(0.0);
  }

  let cellSize = max(64.0, drawLine.linkBundlingCellSize);
  let mid = (a + b) * 0.5;
  let laneCell = (floor(mid / cellSize) + vec2<f32>(0.5)) * cellSize;
  let xDir = xBasis / linkDist;
  let laneTarget = laneCell + xDir * dot(mid - laneCell, xDir);
  var displacement = laneTarget - mid;

  let maxNudge = min(cellSize * 0.36, linkDist * 0.18);
  let displacementLen = length(displacement);
  if (displacementLen > maxNudge) {
    displacement = displacement * (maxNudge / max(displacementLen, 1e-6));
  }

  // Keep exact endpoints. Middle vertices get the most correction, with a
  // tiny deterministic strand offset so compatible edges read as lanes rather
  // than one over-smoothed tube.
  let envelope = pow(max(0.0, sin(3.14159265 * clamp(t, 0.0, 1.0))), 1.35);
  let strand = (hash11(linkIndex + floor(mid.x / cellSize) * 17.0 + floor(mid.y / cellSize) * 131.0) - 0.5) *
    min(cellSize * 0.025, linkDist * 0.012);
  return (displacement * drawLine.linkBundlingStrength + yBasis * strand) * envelope;
}
`

const straightLineVertexMainWgsl = `
@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.pos = input.position;
  output.linkIndex = input.linkIndices;
  output.rgbaColor = vec4<f32>(0.0);
  output.arrowLength = 0.0;
  output.useArrow = 0.0;
  output.smoothing = 0.0;
  output.arrowWidthFactor = 0.0;

  let textureSize = u32(drawLine.pointsTextureSize);
  let idxA = u32(input.pointA.y) * textureSize + u32(input.pointA.x);
  let idxB = u32(input.pointB.y) * textureSize + u32(input.pointB.x);
  let a = mix(previousPositions[idxA], positions[idxA], drawLine.renderPositionMix).xy;
  let b = mix(previousPositions[idxB], positions[idxB], drawLine.renderPositionMix).xy;

  let aNorm = (2.0 * a / drawLine.spaceSize - vec2<f32>(1.0)) * (drawLine.spaceSize / drawLine.screenSize);
  let bNorm = (2.0 * b / drawLine.spaceSize - vec2<f32>(1.0)) * (drawLine.spaceSize / drawLine.screenSize);
  let aNDC = (drawLine.transformationMatrix * vec4<f32>(aNorm, 1.0, 1.0)).xy;
  let bNDC = (drawLine.transformationMatrix * vec4<f32>(bNorm, 1.0, 1.0)).xy;
  let linkCullMargin: f32 = 0.15;
  if ((aNDC.x < -1.0 - linkCullMargin && bNDC.x < -1.0 - linkCullMargin) ||
      (aNDC.x > 1.0 + linkCullMargin && bNDC.x > 1.0 + linkCullMargin) ||
      (aNDC.y < -1.0 - linkCullMargin && bNDC.y < -1.0 - linkCullMargin) ||
      (aNDC.y > 1.0 + linkCullMargin && bNDC.y > 1.0 + linkCullMargin)) {
    output.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
    return output;
  }

  let xBasis = b - a;
  let linkDist = length(xBasis);
  let scale = drawLine.transformationMatrix[0][0];
  let linkDistPx = linkDist * scale;
  if (drawLine.linkMinPixelLength > 0.0 && linkDistPx < drawLine.linkMinPixelLength) {
    output.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
    return output;
  }

  var lodAlpha = 1.0;
  var lodWidthComp = 1.0;
  let isImportantLink = drawLine.hoveredLinkIndex == output.linkIndex || drawLine.focusedLinkIndex == output.linkIndex;
  let lodWeight = linkLodWeight(scale);
  if (drawLine.renderMode <= 0.0 && lodWeight > 0.0 && !isImportantLink) {
    let minSampleRate = clamp(drawLine.linkLodMinSampleRate, 0.02, 1.0);
    let sampleRate = mix(1.0, minSampleRate, lodWeight);
    let h = hash11(input.linkIndices + 37.0);
    let feather = max(0.015, 0.14 * lodWeight * (1.0 - sampleRate));
    let sampleAlpha = 1.0 - smoothstep(sampleRate, min(1.0, sampleRate + feather), h);
    if (sampleAlpha <= 0.001) {
      output.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      return output;
    }
    let representation = 1.0 / max(sampleRate, 0.02);
    lodWidthComp = mix(1.0, min(1.7, sqrt(representation)), lodWeight * drawLine.linkLodWidthCompensation);
    let alphaComp = mix(1.0, min(3.2, representation), lodWeight * drawLine.linkLodOpacityCompensation);
    lodAlpha = sampleAlpha * alphaComp;
  }

  var linkWidth = input.width * drawLine.widthScale * lodWidthComp;
  let k: f32 = 2.0;
  var arrowWidth = linkWidth * k;
  arrowWidth = arrowWidth * drawLine.linkArrowsSizeScale;
  let arrowWidthDifference = max(0.0, arrowWidth - linkWidth);
  let arrowWidthPx = calculateArrowWidth(arrowWidth);

  output.useArrow = input.arrow;
  output.arrowLength = min(0.3, (0.866 * arrowWidthPx * 2.0) / max(linkDist, 1e-6));
  if (output.useArrow > 0.5) {
    linkWidth = linkWidth + arrowWidthDifference;
  }
  output.arrowWidthFactor = arrowWidthDifference / max(linkWidth, 1e-6);

  var linkWidthPx = calculateLinkWidth(linkWidth, output.useArrow);
  if (drawLine.renderMode > 0.0) {
    linkWidthPx = linkWidthPx + 5.0 / scale;
    if (drawLine.hoveredLinkIndex == output.linkIndex) {
      linkWidthPx = linkWidthPx + drawLine.hoveredLinkWidthIncrease / scale;
    }
    if (drawLine.focusedLinkIndex == output.linkIndex) {
      linkWidthPx = linkWidthPx + drawLine.focusedLinkWidthIncrease / scale;
    }
  } else {
    if (drawLine.hoveredLinkIndex == output.linkIndex) {
      linkWidthPx = linkWidthPx + drawLine.hoveredLinkWidthIncrease / scale;
    }
    if (drawLine.focusedLinkIndex == output.linkIndex) {
      linkWidthPx = linkWidthPx + drawLine.focusedLinkWidthIncrease / scale;
    }
  }
  let smoothingPx = 0.5 / scale;
  output.smoothing = smoothingPx / max(linkWidthPx, 1e-6);
  linkWidthPx = linkWidthPx + smoothingPx;

  let rgbColor = input.color.rgb;
  var opacity = input.color.a * drawLine.linkOpacity * max(
    drawLine.linkVisibilityMinTransparency,
    map(linkDistPx, drawLine.linkVisibilityDistanceRange.y, drawLine.linkVisibilityDistanceRange.x, 0.0, 1.0),
  );
  opacity = min(1.0, opacity * lodAlpha);

  if (drawLine.isLinkHighlightingActive > 0.0 && drawLine.linkStatusTextureSize > 0.0) {
    let statusTexSize = drawLine.linkStatusTextureSize;
    let texX = input.linkIndices - statusTexSize * floor(input.linkIndices / statusTexSize);
    let texY = floor(input.linkIndices / statusTexSize);
    let linkStatusCoord = (vec2<f32>(texX, texY) + vec2<f32>(0.5)) / statusTexSize;
    let linkStatusValue = textureSampleLevel(linkStatus, linkStatusSampler, linkStatusCoord, 0.0);
    if (linkStatusValue.r > 0.0) {
      opacity = opacity * drawLine.greyoutOpacity;
    }
  }

  var rgbaColor = vec4<f32>(rgbColor, opacity);
  if (drawLine.hoveredLinkIndex == output.linkIndex && drawLine.hoveredLinkColor.a > -0.5) {
    rgbaColor = vec4<f32>(drawLine.hoveredLinkColor.rgb, rgbaColor.a * drawLine.hoveredLinkColor.a);
  }
  output.rgbaColor = rgbaColor;

  let yBasis = normalize(vec2<f32>(-xBasis.y, xBasis.x));
  let laneOffset = softLaneOffset(a, b, yBasis, input.linkIndices, input.position.x);
  let pointCurr = mix(a, b, input.position.x) + laneOffset + yBasis * linkWidthPx * input.position.y;
  var p = 2.0 * pointCurr / drawLine.spaceSize - vec2<f32>(1.0);
  p = p * (drawLine.spaceSize / drawLine.screenSize);
  let finalPosition = drawLine.transformationMatrix * vec4<f32>(p, 1.0, 1.0);
  output.position = vec4<f32>(finalPosition.xy, 0.0, 1.0);
  return output;
}
`

export function drawStraightLineWgslSource (): string {
  return composeLineDrawShaderWgsl({
    intro: straightLineIntroWgsl,
    additionalHelpers: straightLineHelpersWgsl,
    vertexMain: straightLineVertexMainWgsl,
  })
}
