// WGSL counterpart to fill-sampled-links.vert + fill-sampled-links.frag.
// One file, both entry points, used when useWebGPU = true.
//
// Custom vertex shader: one vertex per link (topology: 'point-list').
// Each vertex reads endpoint positions from positionsTexture, computes the
// link midpoint (straight or rational-quadratic-Bezier midpoint when curved),
// projects to screen space, and writes (linkIndex, midX, midY, angle) into
// the sampled-links FBO cell at that screen pixel.

// Rational quadratic Bezier (conic parametric curve), inlined from
// conic-curve-module.ts since WGSL has no shadertools-style module include.
fn conicParametricCurve(A: vec2<f32>, B: vec2<f32>, ControlPoint: vec2<f32>, t: f32, w: f32) -> vec2<f32> {
  let oneMinusT = 1.0 - t;
  let divident = oneMinusT * oneMinusT * A + 2.0 * oneMinusT * t * w * ControlPoint + t * t * B;
  let divisor = oneMinusT * oneMinusT + 2.0 * oneMinusT * t * w + t * t;
  return divident / divisor;
}

struct FillSampledLinksUniforms {
  pointsTextureSize: f32,
  transformationMatrix: mat4x4<f32>,
  spaceSize: f32,
  screenSize: vec2<f32>,
  curvedWeight: f32,
  curvedLinkControlPointDistance: f32,
  curvedLinkSegments: f32,
};

@group(0) @binding(0) var<uniform> fillSampledLinks: FillSampledLinksUniforms;
@group(0) @binding(1) var positionsTexture: texture_2d<f32>;
@group(0) @binding(2) var positionsSampler: sampler;

struct VertexInput {
  @location(0) pointA: vec2<f32>,
  @location(1) pointB: vec2<f32>,
  @location(2) linkIndices: f32,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) rgba: vec4<f32>,
};

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  let posA = textureSampleLevel(
    positionsTexture,
    positionsSampler,
    (input.pointA + vec2<f32>(0.5)) / fillSampledLinks.pointsTextureSize,
    0.0,
  );
  let posB = textureSampleLevel(
    positionsTexture,
    positionsSampler,
    (input.pointB + vec2<f32>(0.5)) / fillSampledLinks.pointsTextureSize,
    0.0,
  );
  let a = posA.rg;
  let b = posB.rg;

  let tangent = b - a;
  let angle = -atan2(tangent.y, tangent.x);

  var mid: vec2<f32>;
  if (fillSampledLinks.curvedLinkSegments <= 1.0) {
    mid = (a + b) * 0.5;
  } else if (fillSampledLinks.curvedLinkControlPointDistance != 0.0 && fillSampledLinks.curvedWeight != 0.0) {
    let xBasis = b - a;
    let yBasis = normalize(vec2<f32>(-xBasis.y, xBasis.x));
    let linkDist = length(xBasis);
    let h = fillSampledLinks.curvedLinkControlPointDistance;
    let controlPoint = (a + b) / 2.0 + yBasis * linkDist * h;
    mid = conicParametricCurve(a, b, controlPoint, 0.5, fillSampledLinks.curvedWeight);
  } else {
    mid = (a + b) * 0.5;
  }

  var p = 2.0 * mid / fillSampledLinks.spaceSize - vec2<f32>(1.0);
  p = p * (fillSampledLinks.spaceSize / fillSampledLinks.screenSize);

  // Equivalent to mat3(transformationMatrix) * vec3(p, 1)
  let final = fillSampledLinks.transformationMatrix * vec4<f32>(p, 1.0, 1.0);

  let pointScreenPosition = (final.xy + vec2<f32>(1.0)) * fillSampledLinks.screenSize / 2.0;
  output.rgba = vec4<f32>(input.linkIndices, mid.x, mid.y, angle);

  let i = (pointScreenPosition.x + 0.5) / fillSampledLinks.screenSize.x;
  let j = (pointScreenPosition.y + 0.5) / fillSampledLinks.screenSize.y;
  output.position = vec4<f32>(2.0 * vec2<f32>(i, j) - vec2<f32>(1.0), 0.0, 1.0);

  // NOTE: GLSL sets gl_PointSize = 1.0; WebGPU point primitives are always size 1.
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  return input.rgba;
}
