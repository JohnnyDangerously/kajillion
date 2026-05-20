import { drawLineUniformsStructWgsl } from './line-uniforms.wgsl'

export const conicCurveWgsl = `
fn conicParametricCurve(A: vec2<f32>, B: vec2<f32>, ControlPoint: vec2<f32>, t: f32, w: f32) -> vec2<f32> {
  let oneMinusT = 1.0 - t;
  let divident = oneMinusT * oneMinusT * A + 2.0 * oneMinusT * t * w * ControlPoint + t * t * B;
  let divisor = oneMinusT * oneMinusT + 2.0 * oneMinusT * t * w + t * t;
  return divident / divisor;
}
`

export const drawLineFragmentUniformsStructWgsl = `
struct DrawLineFragmentUniforms {
  renderMode: f32,
  // Specialization flag — host sets to 1 only when the dataset contains at
  // least one arrowed link. The fragment shader's arrow-AA path is dead-
  // stripped by the compiler when this is constant zero, which is the
  // default for graphs that don't customize linkArrows per-instance.
  hasArrowedLinks: f32,
};
`

export const drawLineResourceBindingsWgsl = `@group(0) @binding(0) var<uniform> drawLine: DrawLineUniforms;
@group(0) @binding(1) var<uniform> drawLineFragment: DrawLineFragmentUniforms;
// Vertex-pulling: read endpoint positions from a storage buffer indexed
// by (texY * pointsTextureSize + texX). The legacy texture-sample path
// cost ~600ms/frame at n=100k due to vertex-stage texture sampling.
@group(0) @binding(2) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(3) var linkStatus: texture_2d<f32>;
@group(0) @binding(4) var linkStatusSampler: sampler;
@group(0) @binding(5) var<storage, read> previousPositions: array<vec4<f32>>;`

export const drawLineFullVertexInputWgsl = `struct VertexInput {
  @location(0) position: vec2<f32>,
  @location(1) pointA: vec2<f32>,
  @location(2) pointB: vec2<f32>,
  @location(3) color: vec4<f32>,
  @location(4) width: f32,
  @location(5) arrow: f32,
  @location(6) linkIndices: f32,
};`

export const drawLinePositionOnlyVertexInputWgsl = `struct VertexInput {
  @location(0) position: vec2<f32>,
};`

const drawLineVertexOutputWgsl = `
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
`

const drawLineMathHelpersWgsl = `
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
`

const drawLineFragmentMainWgsl = `
@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  var opacity: f32 = 1.0;
  let color = input.rgbaColor.rgb;

  // Uniform-gated fast path: when zero links in the dataset are arrowed
  // (the default for plain edge data), the compiler dead-strips the whole
  // arrow-AA branch and leaves only the cheap single-smoothstep line AA.
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
  // Premultiplied alpha output (pairs with blend: one, one-minus-src-alpha).
  return vec4<f32>(color * opacity, opacity);
}
`

interface ComposeLineDrawShaderOptions {
  intro: string;
  beforeUniforms?: string;
  additionalHelpers?: string;
  vertexMain: string;
}

export function composeLineDrawShaderWgsl (options: ComposeLineDrawShaderOptions): string {
  return `${options.intro}
${options.beforeUniforms ?? ''}${drawLineUniformsStructWgsl}
${drawLineFragmentUniformsStructWgsl}
${drawLineResourceBindingsWgsl}

${drawLineFullVertexInputWgsl}
${drawLineVertexOutputWgsl}
${drawLineMathHelpersWgsl}
${options.additionalHelpers ?? ''}
${options.vertexMain}

// ---------- Fragment shader ----------
${drawLineFragmentMainWgsl}`
}
