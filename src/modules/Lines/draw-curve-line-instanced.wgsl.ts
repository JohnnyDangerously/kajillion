// Thin vertex + fragment shader for the line-render visible pass, paired
// with the precompute-line-instances compute pre-pass.
//
// All per-instance state (positions, controlPoint, perpendicular, color,
// linkWidthPx, smoothing, arrowLength, useArrow, arrowWidthFactor,
// linkIndex, culled) lives in a storage buffer populated by the compute
// shader once per link. The vertex shader just:
//   1. Reads the precomputed LineInstance via @builtin(instance_index)
//   2. Computes the on-curve point at t = input.position.x (Bezier eval
//      for curved mode, mix(a, b, t) for straight)
//   3. Offsets by the perpendicular × linkWidthPx × input.position.y
//   4. Transforms to clip space via mat4
// All the heavy instance-uniform work (~16 ops per legacy vertex × 4 verts
// per quad) is now amortized to 1 thread per link in the compute pass.
//
// Fragment shader is identical to draw-curve-line.wgsl's; copy/pasted to
// avoid factoring across files for ~30 lines. If we ever change the
// fragment math both files must move together.
//
// Used only by the visible (drawCurveCommand) pass. The picking
// (drawCurveIndexCommand) pass keeps the legacy per-vertex shader since
// it runs per hover-detection event, not per frame, and isn't perf-
// critical at frame time.
import {
  drawLineUniformsStructWgsl,
  lineInstanceStructWgsl,
} from '@/graph/modules/Lines/precompute-line-instances.compute.wgsl'

// Same conic curve as the legacy shader; kept inline because WGSL has no
// shadertools-style #include. Identical math, no perf difference.
const conicCurveWgsl = `
fn conicParametricCurve(A: vec2<f32>, B: vec2<f32>, ControlPoint: vec2<f32>, t: f32, w: f32) -> vec2<f32> {
  let oneMinusT = 1.0 - t;
  let divident = oneMinusT * oneMinusT * A + 2.0 * oneMinusT * t * w * ControlPoint + t * t * B;
  let divisor = oneMinusT * oneMinusT + 2.0 * oneMinusT * t * w + t * t;
  return divident / divisor;
}
`

const fragmentWgsl = `
fn map(value: f32, min1: f32, max1: f32, min2: f32, max2: f32) -> f32 {
  return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
}

struct DrawLineFragmentUniforms {
  renderMode: f32,
};

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
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

  if (drawLineFragment.renderMode > 0.0) {
    if (opacity > 0.0) {
      return vec4<f32>(input.linkIndex, 0.0, 0.0, 1.0);
    } else {
      return vec4<f32>(-1.0, 0.0, 0.0, 0.0);
    }
  }
  return vec4<f32>(color * opacity, opacity);
}
`

const drawCurveLineInstancedWgsl = `
${drawLineUniformsStructWgsl}
${lineInstanceStructWgsl}

@group(0) @binding(0) var<uniform> drawLine: DrawLineUniforms;
@group(0) @binding(1) var<uniform> drawLineFragment: DrawLineFragmentUniforms;
@group(0) @binding(2) var<storage, read> instances: array<LineInstance>;

struct VertexInput {
  @location(0) position: vec2<f32>,
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

${conicCurveWgsl}

@vertex
fn vertexMain(input: VertexInput, @builtin(instance_index) instId: u32) -> VertexOutput {
  var output: VertexOutput;
  output.pos = input.position;

  let inst = instances[instId];

  // Hoist the precomputed instance state into named locals; the compiler
  // will keep these in registers, the storage-buffer fetch lands once.
  let a = inst.a.xy;
  let b = inst.b.xy;
  let controlPoint = inst.controlPoint.xy;
  let w = inst.controlPoint.z;
  let yBasis = inst.yBasisPad.xy;
  let linkWidthPx = inst.widthSmoothingArrow.x;
  let smoothing = inst.widthSmoothingArrow.y;
  let arrowLength = inst.widthSmoothingArrow.z;
  let useArrow = inst.widthSmoothingArrow.w;
  let arrowWidthFactor = inst.arrowFactorIndexCulled.x;
  let linkIndex = inst.arrowFactorIndexCulled.y;
  let culled = inst.arrowFactorIndexCulled.z;

  output.linkIndex = linkIndex;
  output.rgbaColor = inst.rgbaColor;
  output.arrowLength = arrowLength;
  output.useArrow = useArrow;
  output.smoothing = smoothing;
  output.arrowWidthFactor = arrowWidthFactor;

  if (culled > 0.5) {
    output.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
    return output;
  }

  // Per-vertex Bezier eval at t = position.x and its neighbors. For
  // straight links (default — curvedLinks: false, curvedLinkSegments: 1)
  // the curve degenerates to a line, but the same code path produces
  // identical output, so we don't branch.
  let t = input.position.x;
  let tPrev = t - 1.0 / drawLine.curvedLinkSegments;
  let tNext = t + 1.0 / drawLine.curvedLinkSegments;

  var pointCurr = conicParametricCurve(a, b, controlPoint, t, w);
  let pointPrev = conicParametricCurve(a, b, controlPoint, max(0.0, tPrev), w);
  let pointNext = conicParametricCurve(a, b, controlPoint, min(tNext, 1.0), w);

  let xBasisCurved = pointNext - pointPrev;
  let yBasisCurved = normalize(vec2<f32>(-xBasisCurved.y, xBasisCurved.x));

  pointCurr = pointCurr + yBasisCurved * linkWidthPx * input.position.y;

  var p = 2.0 * pointCurr / drawLine.spaceSize - vec2<f32>(1.0);
  p = p * (drawLine.spaceSize / drawLine.screenSize);
  let finalPosition = drawLine.transformationMatrix * vec4<f32>(p, 1.0, 1.0);
  output.position = vec4<f32>(finalPosition.xy, 0.0, 1.0);
  return output;
}

${fragmentWgsl}
`

export function drawCurveLineInstancedWgslSource (): string {
  return drawCurveLineInstancedWgsl
}
