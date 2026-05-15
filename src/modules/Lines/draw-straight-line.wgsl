// Straight-link WebGPU draw path for curvedLinks=false.
//
// The curved shader supports rational Bezier ribbons even when host config
// collapses curvedLinkSegments to 1. At large edge counts that still leaves
// unnecessary conic-curve math in the vertex path. This shader preserves the
// same bindings, uniforms, attributes, fragment behavior, and picking mode,
// but expands each link as a simple screen-facing ribbon between endpoints.

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
  linkBundlingStrength: f32,
  linkBundlingCellSize: f32,
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
  linkLodStrength: f32,
  linkLodZoomRange: vec2<f32>,
  linkLodMinSampleRate: f32,
  linkLodWidthCompensation: f32,
  linkLodOpacityCompensation: f32,
  renderPositionMix: f32,
};

struct DrawLineFragmentUniforms {
  renderMode: f32,
  hasArrowedLinks: f32,
};

@group(0) @binding(0) var<uniform> drawLine: DrawLineUniforms;
@group(0) @binding(1) var<uniform> drawLineFragment: DrawLineFragmentUniforms;
@group(0) @binding(2) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(3) var linkStatus: texture_2d<f32>;
@group(0) @binding(4) var linkStatusSampler: sampler;
@group(0) @binding(5) var<storage, read> previousPositions: array<vec4<f32>>;

struct VertexInput {
  @location(0) position: vec2<f32>,
  @location(1) pointA: vec2<f32>,
  @location(2) pointB: vec2<f32>,
  @location(3) color: vec4<f32>,
  @location(4) width: f32,
  @location(5) arrow: f32,
  @location(6) linkIndices: f32,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) rgbaColor: vec4<f32>,
  @location(1) pos: vec2<f32>,
  @location(2) arrowLength: f32,
  @location(3) useArrow: f32,
  @location(4) smoothing: f32,
  @location(5) arrowWidthFactor: f32,
  @location(6) linkIndex: f32,
};

fn map(value: f32, min1: f32, max1: f32, min2: f32, max2: f32) -> f32 {
  return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
}

fn calculateLinkWidth(widthIn: f32, useArrow: f32) -> f32 {
  let scale = drawLine.transformationMatrix[0][0];
  var linkWidth: f32;
  if (drawLine.scaleLinksOnZoom > 0.0) {
    linkWidth = widthIn;
  } else {
    linkWidth = widthIn / scale;
    linkWidth = linkWidth * min(5.0, max(1.0, scale * 0.01));
  }
  if (useArrow > 0.5) {
    return min(linkWidth, (drawLine.maxPointSize * 2.0) / scale);
  } else {
    return min(linkWidth, drawLine.maxPointSize / scale);
  }
}

fn calculateArrowWidth(arrowWidthIn: f32) -> f32 {
  let scale = drawLine.transformationMatrix[0][0];
  if (drawLine.scaleLinksOnZoom > 0.0) {
    return arrowWidthIn;
  } else {
    var arrowWidth = arrowWidthIn / scale;
    arrowWidth = arrowWidth * min(5.0, max(1.0, scale * 0.01));
    return arrowWidth;
  }
}

fn hash11(value: f32) -> f32 {
  return fract(sin(value * 12.9898) * 43758.5453);
}

fn linkLodWeight(scale: f32) -> f32 {
  let farScale = min(drawLine.linkLodZoomRange.x, drawLine.linkLodZoomRange.y);
  let nearScale = max(drawLine.linkLodZoomRange.x, drawLine.linkLodZoomRange.y);
  let overview = 1.0 - smoothstep(farScale, nearScale, scale);
  return clamp(drawLine.linkLodStrength, 0.0, 1.0) * overview;
}

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

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  var opacity: f32 = 1.0;
  let color = input.rgbaColor.rgb;

  if (drawLineFragment.hasArrowedLinks > 0.0 && input.useArrow > 0.5) {
    let end_arrow = 0.5 + input.arrowLength / 2.0;
    let start_arrow = end_arrow - input.arrowLength;
    let arrowWidthDelta = input.arrowWidthFactor / 2.0;
    var linkOpacity = input.rgbaColor.a * smoothstep(
      0.5 - arrowWidthDelta,
      0.5 - arrowWidthDelta - input.smoothing / 2.0,
      abs(input.pos.y),
    );
    var arrowOpacity: f32 = 1.0;
    if (input.pos.x > start_arrow && input.pos.x < start_arrow + input.arrowLength) {
      let xmapped = map(input.pos.x, start_arrow, end_arrow, 0.0, 1.0);
      arrowOpacity = input.rgbaColor.a * smoothstep(
        xmapped - input.smoothing,
        xmapped,
        map(abs(input.pos.y), 0.5, 0.0, 0.0, 1.0),
      );
      if (linkOpacity != arrowOpacity) {
        linkOpacity = max(linkOpacity, arrowOpacity);
      }
    }
    opacity = linkOpacity;
  } else {
    opacity = input.rgbaColor.a * smoothstep(0.5, 0.5 - input.smoothing, abs(input.pos.y));
  }

  if (drawLineFragment.renderMode > 0.0) {
    if (opacity > 0.0) {
      return vec4<f32>(input.linkIndex, 0.0, 0.0, 1.0);
    } else {
      return vec4<f32>(-1.0, 0.0, 0.0, 0.0);
    }
  }
  return vec4<f32>(color * opacity, opacity);
}
