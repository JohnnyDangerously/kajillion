// WGSL counterpart to draw-highlighted.vert + draw-highlighted.frag.
// One file, both entry points, used when useWebGPU = true.
//
// Triangle-strip quad (4 vertices) per highlighted point. The vertex shader
// expands the quad around the selected point's world-space position and
// emits a ring; the fragment shader rasterises it as a smoothed outline
// ring using the same `vertexPosition` varying as a local SDF coordinate.

struct DrawHighlightedUniforms {
  size: f32,
  transformationMatrix: mat4x4<f32>,
  pointsTextureSize: f32,
  sizeScale: f32,
  spaceSize: f32,
  screenSize: vec2<f32>,
  scalePointsOnZoom: f32,
  pointIndex: f32,
  maxPointSize: f32,
  color: vec4<f32>,
  universalPointOpacity: f32,
  greyoutOpacity: f32,
  isDarkenGreyout: f32,
  backgroundColor: vec4<f32>,
  greyoutColor: vec4<f32>,
  width: f32,
};

@group(0) @binding(0) var<uniform> drawHighlighted: DrawHighlightedUniforms;
@group(0) @binding(1) var positionsTexture: texture_2d<f32>;
@group(0) @binding(2) var positionsTextureSampler: sampler;
@group(0) @binding(3) var pointStatus: texture_2d<f32>;
@group(0) @binding(4) var pointStatusSampler: sampler;

struct VertexInput {
  @location(0) vertexCoord: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) vertexPosition: vec2<f32>,
  @location(1) pointOpacity: f32,
  @location(2) rgbColor: vec3<f32>,
};

fn calculatePointSize(pointSize: f32) -> f32 {
  let scale = drawHighlighted.transformationMatrix[0][0];
  var pSize: f32;
  if (drawHighlighted.scalePointsOnZoom > 0.0) {
    pSize = pointSize * scale;
  } else {
    pSize = pointSize;
  }
  return min(pSize, drawHighlighted.maxPointSize);
}

const relativeRingRadius: f32 = 1.3;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.vertexPosition = input.vertexCoord;

  let pointsTexSize = drawHighlighted.pointsTextureSize;
  let pointIndex = drawHighlighted.pointIndex;
  let texX = pointIndex - pointsTexSize * floor(pointIndex / pointsTexSize);
  let texY = floor(pointIndex / pointsTexSize);
  let textureCoordinates = vec2<f32>(texX, texY) + vec2<f32>(0.5);

  let pointPosition = textureSampleLevel(
    positionsTexture,
    positionsTextureSampler,
    textureCoordinates / pointsTexSize,
    0.0,
  );

  var rgbColor = drawHighlighted.color.rgb;
  var pointOpacity = drawHighlighted.color.a * drawHighlighted.universalPointOpacity;
  let greyoutStatus = textureSampleLevel(
    pointStatus,
    pointStatusSampler,
    textureCoordinates / pointsTexSize,
    0.0,
  );
  if (greyoutStatus.r > 0.0) {
    if (drawHighlighted.greyoutColor[0] != -1.0) {
      rgbColor = drawHighlighted.greyoutColor.rgb;
      pointOpacity = drawHighlighted.greyoutColor.a;
    } else {
      let blendFactor: f32 = 0.65;
      if (drawHighlighted.isDarkenGreyout > 0.0) {
        rgbColor = mix(rgbColor, vec3<f32>(0.2), blendFactor);
      } else {
        rgbColor = mix(rgbColor, max(drawHighlighted.backgroundColor.rgb, vec3<f32>(0.8)), blendFactor);
      }
    }

    if (drawHighlighted.greyoutOpacity != -1.0) {
      pointOpacity = pointOpacity * drawHighlighted.greyoutOpacity;
    }
  }

  output.rgbColor = rgbColor;
  output.pointOpacity = pointOpacity;

  // Calculate point radius
  let scale = drawHighlighted.transformationMatrix[0][0];
  let pointSize = (calculatePointSize(drawHighlighted.size * drawHighlighted.sizeScale) * relativeRingRadius) / scale;
  let radius = pointSize * 0.5;

  // Calculate point position in screen space
  let a = pointPosition.xy;
  let b = pointPosition.xy + vec2<f32>(0.0, radius);
  let xBasis = b - a;
  let yBasis = normalize(vec2<f32>(-xBasis.y, xBasis.x));
  let pointPositionInScreenSpace = a + xBasis * input.vertexCoord.x + yBasis * radius * input.vertexCoord.y;

  // Transform point position to normalized device coordinates
  var p = 2.0 * pointPositionInScreenSpace / drawHighlighted.spaceSize - vec2<f32>(1.0);
  p = p * (drawHighlighted.spaceSize / drawHighlighted.screenSize);
  let finalPosition = drawHighlighted.transformationMatrix * vec4<f32>(p, 1.0, 1.0);

  output.position = vec4<f32>(finalPosition.xy, 0.0, 1.0);
  return output;
}

// ---------- Fragment shader ----------

const ringSmoothing: f32 = 1.05;

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let r = dot(input.vertexPosition, input.vertexPosition);
  let opacity = smoothstep(r, r * ringSmoothing, 1.0);
  let stroke = smoothstep(drawHighlighted.width, drawHighlighted.width * ringSmoothing, r);
  return vec4<f32>(input.rgbColor, opacity * stroke * input.pointOpacity);
}
