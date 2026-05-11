// WGSL counterpart to draw-curve-line.vert + draw-curve-line.frag.
// One file, both entry points, used when useWebGPU = true.
//
// Triangle-strip geometry (per-link instance) sweeping a curved Bezier
// ribbon between two point indices. The vertex shader samples both endpoint
// positions, builds a rational quadratic Bezier control point for the
// curved case, calculates the link width (with hover/focus widening and
// optional zoom-aware scaling), applies link visibility/greyout fading,
// and emits a varying per-segment used to draw either the link body or an
// arrow head in the fragment shader. The fragment shader doubles as a
// link picker when renderMode > 0 (writes the link index instead of colour).

// Rational quadratic Bezier (conic parametric curve), inlined from
// conic-curve-module.ts since WGSL has no shadertools-style module include.
fn conicParametricCurve(A: vec2f, B: vec2f, ControlPoint: vec2f, t: f32, w: f32) -> vec2f {
  let oneMinusT = 1.0 - t;
  let divident = oneMinusT * oneMinusT * A + 2.0 * oneMinusT * t * w * ControlPoint + t * t * B;
  let divisor = oneMinusT * oneMinusT + 2.0 * oneMinusT * t * w + t * t;
  return divident / divisor;
}

struct DrawLineUniforms {
  transformationMatrix: mat4x4<f32>,
  pointsTextureSize: f32,
  widthScale: f32,
  linkArrowsSizeScale: f32,
  spaceSize: f32,
  screenSize: vec2f,
  linkVisibilityDistanceRange: vec2f,
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
  hoveredLinkColor: vec4f,
  hoveredLinkWidthIncrease: f32,
  isLinkHighlightingActive: f32,
  linkStatusTextureSize: f32,
  focusedLinkIndex: f32,
  focusedLinkWidthIncrease: f32,
  linkMinPixelLength: f32,
};

struct DrawLineFragmentUniforms {
  renderMode: f32,
};

@group(0) @binding(0) var<uniform> drawLine: DrawLineUniforms;
@group(0) @binding(1) var<uniform> drawLineFrag: DrawLineFragmentUniforms;
@group(0) @binding(2) var positionsTexture: texture_2d<f32>;
@group(0) @binding(3) var positionsSampler: sampler;
@group(0) @binding(4) var linkStatus: texture_2d<f32>;
@group(0) @binding(5) var linkStatusSampler: sampler;

struct VertexInput {
  @location(0) position: vec2f,
  @location(1) pointA: vec2f,
  @location(2) pointB: vec2f,
  @location(3) color: vec4f,
  @location(4) width: f32,
  @location(5) arrow: f32,
  @location(6) linkIndices: f32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) rgbaColor: vec4f,
  @location(1) pos: vec2f,
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

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.pos = input.position;
  output.linkIndex = input.linkIndices;
  output.rgbaColor = vec4f(0.0);
  output.arrowLength = 0.0;
  output.useArrow = 0.0;
  output.smoothing = 0.0;
  output.arrowWidthFactor = 0.0;

  let pointTexturePosA = (input.pointA + vec2f(0.5)) / drawLine.pointsTextureSize;
  let pointTexturePosB = (input.pointB + vec2f(0.5)) / drawLine.pointsTextureSize;

  let pointPositionA = textureSampleLevel(positionsTexture, positionsSampler, pointTexturePosA, 0.0);
  let pointPositionB = textureSampleLevel(positionsTexture, positionsSampler, pointTexturePosB, 0.0);
  let a = pointPositionA.xy;
  let b = pointPositionB.xy;

  // Frustum cull: if both endpoints sit off the same screen edge, skip.
  let aNorm = (2.0 * a / drawLine.spaceSize - vec2f(1.0)) * (drawLine.spaceSize / drawLine.screenSize);
  let bNorm = (2.0 * b / drawLine.spaceSize - vec2f(1.0)) * (drawLine.spaceSize / drawLine.screenSize);
  let aNDC = (drawLine.transformationMatrix * vec4f(aNorm, 1.0, 1.0)).xy;
  let bNDC = (drawLine.transformationMatrix * vec4f(bNorm, 1.0, 1.0)).xy;
  let linkCullMargin: f32 = 0.15;
  if ((aNDC.x < -1.0 - linkCullMargin && bNDC.x < -1.0 - linkCullMargin) ||
      (aNDC.x > 1.0 + linkCullMargin && bNDC.x > 1.0 + linkCullMargin) ||
      (aNDC.y < -1.0 - linkCullMargin && bNDC.y < -1.0 - linkCullMargin) ||
      (aNDC.y > 1.0 + linkCullMargin && bNDC.y > 1.0 + linkCullMargin)) {
    output.position = vec4f(2.0, 2.0, 2.0, 1.0);
    return output;
  }

  // Calculate direction vector and its perpendicular
  let xBasis = b - a;
  let yBasis = normalize(vec2f(-xBasis.y, xBasis.x));

  // Calculate link distance and control point for curved link
  let linkDist = length(xBasis);
  let h = drawLine.curvedLinkControlPointDistance;
  let controlPoint = (a + b) / 2.0 + yBasis * linkDist * h;

  let scale = drawLine.transformationMatrix[0][0];

  // Convert link distance to screen pixels
  let linkDistPx = linkDist * scale;

  // Hard-skip rendering when the link's screen length falls below the threshold.
  if (drawLine.linkMinPixelLength > 0.0 && linkDistPx < drawLine.linkMinPixelLength) {
    output.position = vec4f(2.0, 2.0, 2.0, 1.0);
    return output;
  }

  // Calculate line width using the width scale
  var linkWidth = input.width * drawLine.widthScale;
  let k: f32 = 2.0;
  // Arrow width is proportionally larger than the line width
  var arrowWidth = linkWidth * k;
  arrowWidth = arrowWidth * drawLine.linkArrowsSizeScale;

  // Ensure arrow width difference is non-negative
  let arrowWidthDifference = max(0.0, arrowWidth - linkWidth);

  // Calculate arrow width in pixels
  let arrowWidthPx = calculateArrowWidth(arrowWidth);

  // Calculate arrow length proportional to its width (0.866 ~= sqrt(3)/2)
  output.arrowLength = min(0.3, (0.866 * arrowWidthPx * 2.0) / linkDist);

  output.useArrow = input.arrow;
  if (output.useArrow > 0.5) {
    linkWidth = linkWidth + arrowWidthDifference;
  }

  output.arrowWidthFactor = arrowWidthDifference / linkWidth;

  // Calculate final link width in pixels with smoothing
  var linkWidthPx = calculateLinkWidth(linkWidth, output.useArrow);

  if (drawLine.renderMode > 0.0) {
    // Add 5 pixels padding for better hover detection
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
  output.smoothing = smoothingPx / linkWidthPx;
  linkWidthPx = linkWidthPx + smoothingPx;

  // Calculate final color with opacity based on link distance
  let rgbColor = input.color.rgb;
  // Adjust opacity based on link distance
  var opacity = input.color.a * drawLine.linkOpacity * max(
    drawLine.linkVisibilityMinTransparency,
    map(linkDistPx, drawLine.linkVisibilityDistanceRange.g, drawLine.linkVisibilityDistanceRange.r, 0.0, 1.0),
  );

  // Apply greyed-out opacity from link status texture
  if (drawLine.isLinkHighlightingActive > 0.0 && drawLine.linkStatusTextureSize > 0.0) {
    let statusTexSize = drawLine.linkStatusTextureSize;
    let texX = input.linkIndices - statusTexSize * floor(input.linkIndices / statusTexSize);
    let texY = floor(input.linkIndices / statusTexSize);
    let linkStatusCoord = (vec2f(texX, texY) + vec2f(0.5)) / statusTexSize;
    let linkStatusValue = textureSampleLevel(linkStatus, linkStatusSampler, linkStatusCoord, 0.0);
    if (linkStatusValue.r > 0.0) {
      opacity = opacity * drawLine.greyoutOpacity;
    }
  }

  // Pass final color to fragment shader
  var rgbaColor = vec4f(rgbColor, opacity);

  // Apply hover color if this is the hovered link and hover color is defined
  if (drawLine.hoveredLinkIndex == output.linkIndex && drawLine.hoveredLinkColor.a > -0.5) {
    rgbaColor = vec4f(drawLine.hoveredLinkColor.rgb, rgbaColor.a * drawLine.hoveredLinkColor.a);
  }
  output.rgbaColor = rgbaColor;

  // Calculate position on the curved path
  let t = input.position.x;
  let w = drawLine.curvedWeight;

  let tPrev = t - 1.0 / drawLine.curvedLinkSegments;
  let tNext = t + 1.0 / drawLine.curvedLinkSegments;

  var pointCurr = conicParametricCurve(a, b, controlPoint, t, w);

  let pointPrev = conicParametricCurve(a, b, controlPoint, max(0.0, tPrev), w);
  let pointNext = conicParametricCurve(a, b, controlPoint, min(tNext, 1.0), w);

  let xBasisCurved = pointNext - pointPrev;
  let yBasisCurved = normalize(vec2f(-xBasisCurved.y, xBasisCurved.x));

  pointCurr = pointCurr + yBasisCurved * linkWidthPx * input.position.y;

  // Transform to clip space coordinates
  var p = 2.0 * pointCurr / drawLine.spaceSize - vec2f(1.0);
  p = p * (drawLine.spaceSize / drawLine.screenSize);

  let finalPosition = drawLine.transformationMatrix * vec4f(p, 1.0, 1.0);
  output.position = vec4f(finalPosition.xy, 0.0, 1.0);
  return output;
}

// ---------- Fragment shader ----------

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  var opacity: f32 = 1.0;
  let color = input.rgbaColor.rgb;

  if (input.useArrow > 0.5) {
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

  if (drawLineFrag.renderMode > 0.0) {
    if (opacity > 0.0) {
      return vec4f(input.linkIndex, 0.0, 0.0, 1.0);
    } else {
      return vec4f(-1.0, 0.0, 0.0, 0.0);
    }
  }
  return vec4f(color, opacity);
}
