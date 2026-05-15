import drawCurveLineWgsl from '@/graph/modules/Lines/draw-curve-line.wgsl?raw'

export function drawCulledCurveLinesWgsl (): string {
  return drawCurveLineWgsl
    .replace(
      `@group(0) @binding(2) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(3) var linkStatus: texture_2d<f32>;
@group(0) @binding(4) var linkStatusSampler: sampler;
@group(0) @binding(5) var<storage, read> previousPositions: array<vec4<f32>>;`,
      `@group(0) @binding(2) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(3) var linkStatus: texture_2d<f32>;
@group(0) @binding(4) var linkStatusSampler: sampler;
@group(0) @binding(5) var<storage, read> pointAArr: array<vec2<f32>>;
@group(0) @binding(6) var<storage, read> pointBArr: array<vec2<f32>>;
@group(0) @binding(7) var<storage, read> colorArr: array<vec4<f32>>;
@group(0) @binding(8) var<storage, read> widthArr: array<f32>;
@group(0) @binding(9) var<storage, read> arrowArr: array<f32>;
@group(0) @binding(10) var<storage, read> linkIndexArr: array<f32>;
@group(0) @binding(11) var<storage, read> visibleIndices: array<u32>;`
    )
    .replace(
      `struct VertexInput {
  @location(0) position: vec2<f32>,
  @location(1) pointA: vec2<f32>,
  @location(2) pointB: vec2<f32>,
  @location(3) color: vec4<f32>,
  @location(4) width: f32,
  @location(5) arrow: f32,
  @location(6) linkIndices: f32,
};`,
      `struct VertexInput {
  @location(0) position: vec2<f32>,
};`
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
  let linkIndex = linkIndexArr[sourceLinkIndex];
  output.linkIndex = linkIndex;`
    )
    .replace(/input\.pointA/g, 'pointA')
    .replace(/input\.pointB/g, 'pointB')
    .replace(/input\.color/g, 'color')
    .replace(/input\.width/g, 'width')
    .replace(/input\.arrow\b/g, 'arrow')
    .replace(/input\.linkIndices/g, 'linkIndex')
    .replace(/mix\(previousPositions\[(idxA|idxB)\], positions\[\1\], drawLine\.renderPositionMix\)/g, 'positions[$1]')
}
