import { drawCurveLineWgslSource } from '@/graph/modules/Lines/draw-curve-line.wgsl'
import {
  drawLineFullVertexInputWgsl,
  drawLinePositionOnlyVertexInputWgsl,
  drawLineResourceBindingsWgsl,
} from '@/graph/modules/Lines/shaders/line-draw-source.wgsl'

const drawCulledLineResourceBindingsWgsl = `@group(0) @binding(0) var<uniform> drawLine: DrawLineUniforms;
@group(0) @binding(1) var<uniform> drawLineFragment: DrawLineFragmentUniforms;
// Vertex-pulling: read endpoint positions from a storage buffer indexed
// by (texY * pointsTextureSize + texX). The legacy texture-sample path
// cost ~600ms/frame at n=100k due to vertex-stage texture sampling.
@group(0) @binding(2) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(3) var linkStatus: texture_2d<f32>;
@group(0) @binding(4) var linkStatusSampler: sampler;
@group(0) @binding(5) var<storage, read> pointAArr: array<vec2<f32>>;
@group(0) @binding(6) var<storage, read> pointBArr: array<vec2<f32>>;
@group(0) @binding(7) var<storage, read> previousPositions: array<vec4<f32>>;
@group(0) @binding(8) var<storage, read> colorArr: array<vec4<f32>>;
@group(0) @binding(9) var<storage, read> widthArr: array<f32>;
@group(0) @binding(10) var<storage, read> arrowArr: array<f32>;
@group(0) @binding(11) var<storage, read> visibleIndices: array<u32>;`

export function drawCulledCurveLinesWgsl (): string {
  return drawCurveLineWgslSource()
    .replace(
      drawLineResourceBindingsWgsl,
      drawCulledLineResourceBindingsWgsl
    )
    .replace(
      drawLineFullVertexInputWgsl,
      drawLinePositionOnlyVertexInputWgsl
    )
    .replace(
      'fn vertexMain(input: VertexInput) -> VertexOutput {',
      'fn vertexMain(input: VertexInput, @builtin(instance_index) instanceIdx: u32) -> VertexOutput {'
    )
    .replace(
      '  output.linkIndex = input.linkIndices;',
      `  let sourceLinkIndex = visibleIndices[instanceIdx];
  let pointA = pointAArr[sourceLinkIndex];
  let pointB = pointBArr[sourceLinkIndex];
  let color = colorArr[sourceLinkIndex];
  let width = widthArr[sourceLinkIndex];
  let arrow = arrowArr[sourceLinkIndex];
  let linkIndex = f32(sourceLinkIndex);
  output.linkIndex = linkIndex;`
    )
    .replace(/input\.pointA/g, 'pointA')
    .replace(/input\.pointB/g, 'pointB')
    .replace(/input\.color/g, 'color')
    .replace(/input\.width/g, 'width')
    .replace(/input\.arrow\b/g, 'arrow')
    .replace(/input\.linkIndices/g, 'linkIndex')
}
