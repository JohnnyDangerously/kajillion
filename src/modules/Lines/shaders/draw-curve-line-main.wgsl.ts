export const curveLineVertexMainWgsl = `
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

  // Storage-buffer vertex-pulling. pointA/pointB are (texX, texY) tex coords;
  // the linear storage index is texY * pointsTextureSize + texX, matching the
  // texture's row-major layout that the sim writes via copyTextureToBuffer.
  let textureSize = u32(drawLine.pointsTextureSize);
  let idxA = u32(input.pointA.y) * textureSize + u32(input.pointA.x);
  let idxB = u32(input.pointB.y) * textureSize + u32(input.pointB.x);
  let pointPositionA = mix(previousPositions[idxA], positions[idxA], drawLine.renderPositionMix);
  let pointPositionB = mix(previousPositions[idxB], positions[idxB], drawLine.renderPositionMix);
  let a = pointPositionA.xy;
  let b = pointPositionB.xy;

  // Frustum cull: if both endpoints sit off the same screen edge, skip.
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

  // Calculate direction vector and its perpendicular
  let xBasis = b - a;
  let yBasis = normalize(vec2<f32>(-xBasis.y, xBasis.x));

  // Calculate link distance and control point for curved link
  let linkDist = length(xBasis);
  let h = drawLine.curvedLinkControlPointDistance;
  let controlPoint = (a + b) / 2.0 + yBasis * linkDist * h;

  let scale = drawLine.transformationMatrix[0][0];

  // Convert link distance to screen pixels
  let linkDistPx = linkDist * scale;

  // Hard-skip rendering when the link's screen length falls below the threshold.
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
    let hSample = hash11(input.linkIndices + 37.0);
    let feather = max(0.015, 0.14 * lodWeight * (1.0 - sampleRate));
    let sampleAlpha = 1.0 - smoothstep(sampleRate, min(1.0, sampleRate + feather), hSample);
    if (sampleAlpha <= 0.001) {
      output.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      return output;
    }
    let representation = 1.0 / max(sampleRate, 0.02);
    lodWidthComp = mix(1.0, min(1.7, sqrt(representation)), lodWeight * drawLine.linkLodWidthCompensation);
    let alphaComp = mix(1.0, min(3.2, representation), lodWeight * drawLine.linkLodOpacityCompensation);
    lodAlpha = sampleAlpha * alphaComp;
  }

  // Calculate line width using the width scale
  var linkWidth = input.width * drawLine.widthScale * lodWidthComp;
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
  // Adjust opacity based on link distance.
  // Range stored as [near, far]: .x (= .r) is the near distance (fully opaque end),
  // .y (= .g) is the far distance (faded end). map() arguments here are
  // intentionally (far, near, 0, 1) so longer links get lower opacity.
  var opacity = input.color.a * drawLine.linkOpacity * max(
    drawLine.linkVisibilityMinTransparency,
    map(linkDistPx, drawLine.linkVisibilityDistanceRange.y, drawLine.linkVisibilityDistanceRange.x, 0.0, 1.0),
  );
  opacity = min(1.0, opacity * lodAlpha);

  // Apply greyed-out opacity from link status texture
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

  // Pass final color to fragment shader
  var rgbaColor = vec4<f32>(rgbColor, opacity);

  // Apply hover color if this is the hovered link and hover color is defined
  if (drawLine.hoveredLinkIndex == output.linkIndex && drawLine.hoveredLinkColor.a > -0.5) {
    rgbaColor = vec4<f32>(drawLine.hoveredLinkColor.rgb, rgbaColor.a * drawLine.hoveredLinkColor.a);
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
  let yBasisCurved = normalize(vec2<f32>(-xBasisCurved.y, xBasisCurved.x));

  pointCurr = pointCurr + yBasisCurved * linkWidthPx * input.position.y;

  // Transform to clip space coordinates
  var p = 2.0 * pointCurr / drawLine.spaceSize - vec2<f32>(1.0);
  p = p * (drawLine.spaceSize / drawLine.screenSize);

  let finalPosition = drawLine.transformationMatrix * vec4<f32>(p, 1.0, 1.0);
  output.position = vec4<f32>(finalPosition.xy, 0.0, 1.0);
  return output;
}
`
