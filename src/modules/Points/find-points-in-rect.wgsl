// WGSL counterpart to find-points-in-rect.frag + Shared/quad.vert.
// One file, both entry points, used when useWebGPU = true.

struct FindPointsInRectUniforms {
  sizeScale: f32,
  spaceSize: f32,
  screenSize: vec2<f32>,
  ratio: f32,
  transformationMatrix: mat4x4<f32>,
  rect0: vec2<f32>,
  rect1: vec2<f32>,
  scalePointsOnZoom: f32,
  maxPointSize: f32,
};

@group(0) @binding(0) var<uniform> findPointsInRect: FindPointsInRectUniforms;
@group(0) @binding(1) var positionsTexture: texture_2d<f32>;
@group(0) @binding(2) var positionsTextureSampler: sampler;
@group(0) @binding(3) var pointSize: texture_2d<f32>;
@group(0) @binding(4) var pointSizeSampler: sampler;

struct VertexInput {
  @location(0) vertexCoord: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) textureCoords: vec2<f32>,
};

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  // [-1, 1] NDC -> [0, 1] texture coords
  output.textureCoords = (input.vertexCoord + vec2<f32>(1.0)) * 0.5;
  output.position = vec4<f32>(input.vertexCoord, 0.0, 1.0);
  return output;
}

fn pointSizeF(size: f32) -> f32 {
  // Extract top-left element from mat4
  let scale = findPointsInRect.transformationMatrix[0][0];
  var pSize: f32;
  if (findPointsInRect.scalePointsOnZoom > 0.0) {
    pSize = size * findPointsInRect.ratio * scale;
  } else {
    pSize = size * findPointsInRect.ratio * min(5.0, max(1.0, scale * 0.01));
  }
  return min(pSize, findPointsInRect.maxPointSize * findPointsInRect.ratio);
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let pointPosition = textureSample(positionsTexture, positionsTextureSampler, input.textureCoords);
  var p = 2.0 * pointPosition.rg / findPointsInRect.spaceSize - vec2<f32>(1.0);
  p = p * (findPointsInRect.spaceSize / findPointsInRect.screenSize);
  let final = findPointsInRect.transformationMatrix * vec4<f32>(p, 1.0, 1.0);

  let pSize = textureSample(pointSize, pointSizeSampler, input.textureCoords);
  let size = pSize.r * findPointsInRect.sizeScale;

  let left = 2.0 * (findPointsInRect.rect0.x - 0.5 * pointSizeF(size)) / findPointsInRect.screenSize.x - 1.0;
  let right = 2.0 * (findPointsInRect.rect1.x + 0.5 * pointSizeF(size)) / findPointsInRect.screenSize.x - 1.0;
  let top = 2.0 * (findPointsInRect.rect0.y - 0.5 * pointSizeF(size)) / findPointsInRect.screenSize.y - 1.0;
  let bottom = 2.0 * (findPointsInRect.rect1.y + 0.5 * pointSizeF(size)) / findPointsInRect.screenSize.y - 1.0;

  var fragColor = vec4<f32>(0.0, 0.0, pointPosition.r, pointPosition.g);
  if (final.x >= left && final.x <= right && final.y >= top && final.y <= bottom) {
    fragColor.r = 1.0;
  }
  return fragColor;
}
