struct DensityUniforms {
  ratio: f32,
  transformationMatrix: mat4x4<f32>,
  spaceSize: f32,
  screenSize: vec2<f32>,
  sizeScale: f32,
  pointOpacity: f32,
  maxPointSize: f32,
  densityPointSizeScale: f32,
};

@group(0) @binding(0) var<uniform> density: DensityUniforms;
@group(0) @binding(1) var<storage, read> positions: array<vec4<f32>>;

struct VertexInput {
  @location(0) quadCorner: vec2<f32>,
  @location(1) size: f32,
  @location(2) color: vec4<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) pointCoord: vec2<f32>,
  @location(1) color: vec4<f32>,
};

fn calculatePointSize(pointSize: f32) -> f32 {
  let scale = density.transformationMatrix[0][0];
  let pSize = pointSize * density.ratio * min(5.0, max(1.0, scale * 0.01));
  return min(pSize, density.maxPointSize * density.ratio) * density.densityPointSizeScale;
}

@vertex
fn vertexMain(input: VertexInput, @builtin(instance_index) instanceIdx: u32) -> VertexOutput {
  var output: VertexOutput;

  let point = positions[instanceIdx].xy;
  var normalizedPosition = 2.0 * point / density.spaceSize - vec2<f32>(1.0);
  normalizedPosition = normalizedPosition * (density.spaceSize / density.screenSize);
  let finalPosition = density.transformationMatrix * vec4<f32>(normalizedPosition, 1.0, 1.0);
  let centerClip = finalPosition.xy;

  let sizePx = max(1.15, calculatePointSize(input.size * density.sizeScale));
  let cullMargin = 2.0 * vec2<f32>(sizePx) / (density.screenSize * density.ratio);
  if (abs(centerClip.x) > 1.0 + cullMargin.x || abs(centerClip.y) > 1.0 + cullMargin.y) {
    output.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
    output.pointCoord = input.quadCorner;
    output.color = vec4<f32>(0.0);
    return output;
  }

  let halfExtentClip = vec2<f32>(
    sizePx / (density.screenSize.x * density.ratio),
    sizePx / (density.screenSize.y * density.ratio),
  );
  output.position = vec4<f32>(centerClip + input.quadCorner * halfExtentClip, 0.0, 1.0);
  output.pointCoord = input.quadCorner;
  output.color = input.color;
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let r2 = dot(input.pointCoord, input.pointCoord);
  if (r2 > 1.0) {
    discard;
  }

  let edge = 1.0 - smoothstep(0.40, 1.0, r2);
  let core = 1.0 - smoothstep(0.0, 0.34, r2);
  let alpha = (edge * 0.18 + core * 0.06) * input.color.a * density.pointOpacity;
  return vec4<f32>(input.color.rgb * alpha, alpha);
}
