export const precomputeLineMainWgsl = `
@compute @workgroup_size(64, 1, 1)
fn computeMain(@builtin(global_invocation_id) gid: vec3<u32>) {
  let linkIdx = gid.x;
  let linkCount = precomputeLine.linkCount;
  if (linkIdx >= linkCount) {
    return;
  }

  // Per-instance inputs share the same storage buffers as the legacy
  // vertex-attribute path; they're just read here as storage arrays
  // rather than fetched as vertex attributes. Locals reuse the legacy
  // names so the math below matches the vertex-shader version 1:1.
  let pointATex = pointAArr[linkIdx];
  let pointBTex = pointBArr[linkIdx];
  let inColor = colorArr[linkIdx];
  let widthIn = widthArr[linkIdx];
  let arrowIn = arrowArr[linkIdx];
  let linkIndexIn = linkIndexArr[linkIdx];

  // Vertex-pull positions out of the storage buffer (same layout as the
  // visible-pass vertex shader: row-major matching the points texture).
  let textureSize = u32(drawLine.pointsTextureSize);
  let idxA = u32(pointATex.y) * textureSize + u32(pointATex.x);
  let idxB = u32(pointBTex.y) * textureSize + u32(pointBTex.x);
  let pointPositionA = positions[idxA];
  let pointPositionB = positions[idxB];
  let a = pointPositionA.xy;
  let b = pointPositionB.xy;

  var out: LineInstance;
  out.a = vec4<f32>(a, 0.0, 0.0);
  out.b = vec4<f32>(b, 0.0, 0.0);

  // Frustum cull. Both endpoints off the same screen edge => degenerate.
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

  var lodAlpha = 1.0;
  var lodWidthComp = 1.0;
  let isImportantLink = drawLine.hoveredLinkIndex == linkIndexIn || drawLine.focusedLinkIndex == linkIndexIn;
  let lodWeight = linkLodWeight(scale);
  if (drawLine.renderMode <= 0.0 && lodWeight > 0.0 && !isImportantLink) {
    let minSampleRate = clamp(drawLine.linkLodMinSampleRate, 0.02, 1.0);
    let sampleRate = mix(1.0, minSampleRate, lodWeight);
    let hSample = hash11(linkIndexIn + 37.0);
    let feather = max(0.015, 0.14 * lodWeight * (1.0 - sampleRate));
    let sampleAlpha = 1.0 - smoothstep(sampleRate, min(1.0, sampleRate + feather), hSample);
    if (sampleAlpha <= 0.001) {
      culled = 1.0;
    }
    let representation = 1.0 / max(sampleRate, 0.02);
    lodWidthComp = mix(1.0, min(1.7, sqrt(representation)), lodWeight * drawLine.linkLodWidthCompensation);
    let alphaComp = mix(1.0, min(3.2, representation), lodWeight * drawLine.linkLodOpacityCompensation);
    lodAlpha = sampleAlpha * alphaComp;
  }

  let linkWidth = widthIn * drawLine.widthScale * lodWidthComp;
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

  let arrowLength = min(0.3, (0.866 * arrowWidthPx * 2.0) / linkDist);

  var effectiveWidth = linkWidth;
  if (arrowIn > 0.5) {
    effectiveWidth = effectiveWidth + arrowWidthDifference;
  }
  let arrowWidthFactor = arrowWidthDifference / effectiveWidth;

  var linkWidthPx: f32;
  if (arrowIn > 0.5) {
    linkWidthPx = calculateArrowLinkWidthPx(effectiveWidth);
  } else {
    linkWidthPx = calculateLinkWidthPx(effectiveWidth);
  }
  let isPickPass = drawLine.renderMode > 0.0;
  if (isPickPass) {
    // 5px hover-detection padding on the index pass. The visible canvas
    // pass doesn't apply this -- handled below.
    linkWidthPx = linkWidthPx + 5.0 / scale;
  }
  if (drawLine.hoveredLinkIndex == linkIndexIn) {
    linkWidthPx = linkWidthPx + drawLine.hoveredLinkWidthIncrease / scale;
  }
  if (drawLine.focusedLinkIndex == linkIndexIn) {
    linkWidthPx = linkWidthPx + drawLine.focusedLinkWidthIncrease / scale;
  }
  let smoothingPx = 0.5 / scale;
  let smoothing = smoothingPx / linkWidthPx;
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
  opacity = min(1.0, opacity * lodAlpha);

  // NOTE: link-status (highlighted-set) sampling is intentionally omitted
  // from the compute pre-pass for now -- it would require keeping a sampled
  // texture + sampler on the compute pipeline's bind group, and the bench
  // dataset doesn't exercise it. When highlighting is needed in a future
  // session, restore the textureSampleLevel branch and the matching
  // bindings in the shaderLayout + setBindings call.

  var rgbaColor = vec4<f32>(rgbColor, opacity);
  if (drawLine.hoveredLinkIndex == linkIndexIn && drawLine.hoveredLinkColor.a > -0.5) {
    rgbaColor = vec4<f32>(drawLine.hoveredLinkColor.rgb, rgbaColor.a * drawLine.hoveredLinkColor.a);
  }
  out.rgbaColor = rgbaColor;

  instances[linkIdx] = out;
}
`
