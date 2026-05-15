export const drawCulledPointsWgsl = `
struct DrawVertexUniforms {
  ratio: f32,
  transformationMatrix: mat4x4<f32>,
  pointsTextureSize: f32,
  sizeScale: f32,
  spaceSize: f32,
  screenSize: vec2<f32>,
  greyoutColor: vec4<f32>,
  backgroundColor: vec4<f32>,
  scalePointsOnZoom: f32,
  maxPointSize: f32,
  isDarkenGreyout: f32,
  skipHighlighted: f32,
  skipGreyed: f32,
  hasImages: f32,
  imageCount: f32,
  imageAtlasCoordsTextureSize: f32,
  pointMinPixelSize: f32,
  pointLodStrength: f32,
  pointLodZoomRange: vec2<f32>,
  pointLodMinSampleRate: f32,
  pointLodSizeCompensation: f32,
  pointLodOpacityCompensation: f32,
  renderPositionMix: f32,
};

struct DrawFragmentUniforms {
  greyoutOpacity: f32,
  pointOpacity: f32,
  isDarkenGreyout: f32,
  backgroundColor: vec4<f32>,
  outlineColor: vec4<f32>,
  outlineWidth: f32,
  hasNonCircleShapes: f32,
  hasOutlinedPoints: f32,
  hasImagedPoints: f32,
};

@group(0) @binding(0) var<uniform> drawVertex: DrawVertexUniforms;
@group(0) @binding(1) var<uniform> drawFragment: DrawFragmentUniforms;
@group(0) @binding(2) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> pointStatusBuf: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> colors: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> sizes: array<f32>;
@group(0) @binding(6) var<storage, read> visibleIndices: array<u32>;
@group(0) @binding(7) var<storage, read> previousPositions: array<vec4<f32>>;

struct VertexInput {
  @location(0) quadCorner: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) shapeColor: vec4<f32>,
  @location(1) pointCoord: vec2<f32>,
  @location(2) isGreyedOut: f32,
  @location(3) isOutlined: f32,
};

const outlineRingScale: f32 = 1.3;

fn calculatePointSize(pointSize: f32) -> f32 {
  let scale = drawVertex.transformationMatrix[0][0];
  var pSize: f32;
  if (drawVertex.scalePointsOnZoom > 0.0) {
    pSize = pointSize * drawVertex.ratio * scale;
  } else {
    pSize = pointSize * drawVertex.ratio * min(5.0, max(1.0, scale * 0.01));
  }
  return min(pSize, drawVertex.maxPointSize * drawVertex.ratio);
}

@vertex
fn vertexMain(input: VertexInput, @builtin(instance_index) instanceIdx: u32) -> VertexOutput {
  var output: VertexOutput;
  let pointIndex = visibleIndices[instanceIdx];
  let status = pointStatusBuf[pointIndex];
  output.isGreyedOut = status.r;
  output.isOutlined = status.g;

  var isHighlighted: f32 = 0.0;
  if (status.r == 0.0) {
    isHighlighted = 1.0;
  }
  if (drawVertex.skipHighlighted > 0.0 && isHighlighted > 0.0) {
    output.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
    return output;
  }
  if (drawVertex.skipGreyed > 0.0 && isHighlighted <= 0.0) {
    output.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
    return output;
  }

  let point = mix(previousPositions[pointIndex], positions[pointIndex], drawVertex.renderPositionMix).xy;
  var normalizedPosition = 2.0 * point / drawVertex.spaceSize - vec2<f32>(1.0);
  normalizedPosition = normalizedPosition * (drawVertex.spaceSize / drawVertex.screenSize);
  let finalPosition = drawVertex.transformationMatrix * vec4<f32>(normalizedPosition, 1.0, 1.0);
  let centerClip = finalPosition.xy;

  var pointSize = calculatePointSize(sizes[pointIndex] * drawVertex.sizeScale);
  if (output.isOutlined > 0.0) {
    pointSize = min(pointSize * outlineRingScale, drawVertex.maxPointSize * drawVertex.ratio);
  }

  let halfExtentClip = vec2<f32>(
    pointSize / (drawVertex.screenSize.x * drawVertex.ratio),
    pointSize / (drawVertex.screenSize.y * drawVertex.ratio),
  );
  output.position = vec4<f32>(centerClip + input.quadCorner * halfExtentClip, 0.0, 1.0);
  output.pointCoord = input.quadCorner;

  var shapeColor = colors[pointIndex];
  if (output.isGreyedOut > 0.0) {
    if (drawVertex.greyoutColor[0] != -1.0) {
      shapeColor = drawVertex.greyoutColor;
    } else {
      let blendFactor: f32 = 0.65;
      if (drawVertex.isDarkenGreyout > 0.0) {
        shapeColor = vec4<f32>(mix(shapeColor.rgb, vec3<f32>(0.2), blendFactor), shapeColor.a);
      } else {
        shapeColor = vec4<f32>(
          mix(shapeColor.rgb, max(drawVertex.backgroundColor.rgb, vec3<f32>(0.8)), blendFactor),
          shapeColor.a,
        );
      }
    }
  }
  output.shapeColor = shapeColor;
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let rSq = dot(input.pointCoord, input.pointCoord);
  if (rSq > 1.1025 && !(drawFragment.hasOutlinedPoints > 0.0 && input.isOutlined > 0.0)) {
    discard;
  }

  let dAA = length(input.pointCoord) - 1.0;
  let aaWidth = max(fwidth(dAA), 1e-4);
  let shapeOpacity = 1.0 - smoothstep(-aaWidth, aaWidth, dAA);

  var finalPointAlpha = shapeOpacity * input.shapeColor.a;
  if (input.isGreyedOut > 0.0 && drawFragment.greyoutOpacity != -1.0) {
    finalPointAlpha = finalPointAlpha * drawFragment.greyoutOpacity;
  } else {
    finalPointAlpha = finalPointAlpha * drawFragment.pointOpacity;
  }
  finalPointAlpha = min(1.0, finalPointAlpha);

  var fragColor = vec4<f32>(input.shapeColor.rgb, finalPointAlpha);

  if (drawFragment.hasOutlinedPoints > 0.0 && input.isOutlined > 0.0) {
    let r = length(input.pointCoord);
    let ringSmoothing: f32 = 1.025;
    let rSafe = max(r, 1e-6);
    let wSafe = max(drawFragment.outlineWidth, 1e-6);
    let outerEdge = smoothstep(rSafe, rSafe * ringSmoothing, 1.0);
    let innerEdge = smoothstep(wSafe, wSafe * ringSmoothing, r);
    let ringAlpha = outerEdge * innerEdge;

    var ringColor = drawFragment.outlineColor.rgb;
    if (input.isGreyedOut > 0.0) {
      let blendFactor: f32 = 0.65;
      if (drawFragment.isDarkenGreyout > 0.0) {
        ringColor = mix(ringColor, vec3<f32>(0.2), blendFactor);
      } else {
        ringColor = mix(ringColor, max(drawFragment.backgroundColor.rgb, vec3<f32>(0.8)), blendFactor);
      }
    }

    let ringOpacity = ringAlpha * drawFragment.outlineColor.a;
    fragColor = vec4<f32>(
      mix(fragColor.rgb, ringColor, ringOpacity),
      max(fragColor.a, ringOpacity),
    );
  }

  return vec4<f32>(fragColor.rgb * fragColor.a, fragColor.a);
}
`
