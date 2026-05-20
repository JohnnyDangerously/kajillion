export const precomputeLineHelpersWgsl = `
fn map(value: f32, min1: f32, max1: f32, min2: f32, max2: f32) -> f32 {
  return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
}

fn calculateLinkWidthPx(widthIn: f32) -> f32 {
  let scale = drawLine.transformationMatrix[0][0];
  var linkWidth: f32;
  if (drawLine.scaleLinksOnZoom > 0.0) {
    linkWidth = widthIn;
  } else {
    linkWidth = widthIn / scale;
    linkWidth = linkWidth * min(5.0, max(1.0, scale * 0.01));
  }
  return min(linkWidth, drawLine.maxPointSize / scale);
}

fn calculateArrowLinkWidthPx(widthIn: f32) -> f32 {
  let scale = drawLine.transformationMatrix[0][0];
  var linkWidth: f32;
  if (drawLine.scaleLinksOnZoom > 0.0) {
    linkWidth = widthIn;
  } else {
    linkWidth = widthIn / scale;
    linkWidth = linkWidth * min(5.0, max(1.0, scale * 0.01));
  }
  return min(linkWidth, (drawLine.maxPointSize * 2.0) / scale);
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
`
