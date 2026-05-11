// WGSL counterpart to draw-points.vert + draw-points.frag.
// One file, both entry points, used when useWebGPU = true.
//
// Custom vertex shader: one vertex per point (topology: 'point-list').
// Renders point sprites with multiple SDF shape variants (circle, square,
// triangle, diamond, pentagon, hexagon, star, cross) plus optional image
// atlas sampling and an outline ring.
//
// WebGPU porting notes:
//   * WGSL has no `gl_PointSize` — WebGPU point primitives are always 1px.
//     Every assignment of `gl_PointSize` in the GLSL is preserved as a
//     `// TODO WebGPU: gl_PointSize` comment. The engine will need instanced
//     quad emulation to render sprites at non-unit size; this file is written
//     so the pipeline compiles and runs at point-size 1 in the meantime.
//   * WGSL has no `gl_PointCoord` either. The fragment shader receives a
//     single pixel per point, so the SDF coordinate `pointCoord` is forced
//     to vec2f(0.0) (the centre of a point sprite). This is also blocked
//     on instanced-quad emulation.

struct DrawVertexUniforms {
  ratio: f32,
  transformationMatrix: mat4x4<f32>,
  pointsTextureSize: f32,
  sizeScale: f32,
  spaceSize: f32,
  screenSize: vec2f,
  greyoutColor: vec4f,
  backgroundColor: vec4f,
  scalePointsOnZoom: f32,
  maxPointSize: f32,
  isDarkenGreyout: f32,
  skipHighlighted: f32,
  skipGreyed: f32,
  hasImages: f32,
  imageCount: f32,
  imageAtlasCoordsTextureSize: f32,
  pointMinPixelSize: f32,
};

struct DrawFragmentUniforms {
  greyoutOpacity: f32,
  pointOpacity: f32,
  isDarkenGreyout: f32,
  backgroundColor: vec4f,
  outlineColor: vec4f,
  outlineWidth: f32,
};

@group(0) @binding(0) var<uniform> drawVertex: DrawVertexUniforms;
@group(0) @binding(1) var<uniform> drawFragment: DrawFragmentUniforms;
@group(0) @binding(2) var positionsTexture: texture_2d<f32>;
@group(0) @binding(3) var positionsSampler: sampler;
@group(0) @binding(4) var pointStatus: texture_2d<f32>;
@group(0) @binding(5) var pointStatusSampler: sampler;
@group(0) @binding(6) var imageAtlasTexture: texture_2d<f32>;
@group(0) @binding(7) var imageAtlasSampler: sampler;
@group(0) @binding(8) var imageAtlasCoords: texture_2d<f32>;
@group(0) @binding(9) var imageAtlasCoordsSampler: sampler;

struct VertexInput {
  @location(0) pointIndices: vec2f,
  @location(1) size: f32,
  @location(2) color: vec4f,
  @location(3) shape: f32,
  @location(4) imageIndex: f32,
  @location(5) imageSize: f32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) pointShape: f32,
  @location(1) isGreyedOut: f32,
  @location(2) isOutlined: f32,
  @location(3) shapeColor: vec4f,
  @location(4) imageAtlasUV: vec4f,
  @location(5) shapeSize: f32,
  @location(6) imageSizeVarying: f32,
  @location(7) overallSize: f32,
};

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

const outlineRingScale: f32 = 1.3;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.pointShape = 0.0;
  output.isGreyedOut = 0.0;
  output.isOutlined = 0.0;
  output.shapeColor = vec4f(0.0);
  output.imageAtlasUV = vec4f(-1.0);
  output.shapeSize = 0.0;
  output.imageSizeVarying = 0.0;
  output.overallSize = 0.0;

  let uv = (input.pointIndices + vec2f(0.5)) / drawVertex.pointsTextureSize;

  // Read point status texture: R = greyout, G = outlined
  let status = textureSampleLevel(pointStatus, pointStatusSampler, uv, 0.0);
  output.isGreyedOut = status.r;
  output.isOutlined = status.g;
  var isHighlighted: f32 = 0.0;
  if (status.r == 0.0) {
    isHighlighted = 1.0;
  }

  // Discard point based on rendering mode
  if (drawVertex.skipHighlighted > 0.0 && isHighlighted > 0.0) {
    output.position = vec4f(2.0, 2.0, 2.0, 1.0);
    // TODO WebGPU: gl_PointSize = 0.0;
    return output;
  }
  if (drawVertex.skipGreyed > 0.0 && isHighlighted <= 0.0) {
    output.position = vec4f(2.0, 2.0, 2.0, 1.0);
    // TODO WebGPU: gl_PointSize = 0.0;
    return output;
  }

  // Position
  let pointPosition = textureSampleLevel(positionsTexture, positionsSampler, uv, 0.0);
  let point = pointPosition.rg;

  // Transform point position to normalized device coordinates
  var normalizedPosition = 2.0 * point / drawVertex.spaceSize - vec2f(1.0);
  normalizedPosition = normalizedPosition * (drawVertex.spaceSize / drawVertex.screenSize);

  // Equivalent to mat3(transformationMatrix) * vec3(normalizedPosition, 1)
  let finalPosition = drawVertex.transformationMatrix * vec4f(normalizedPosition, 1.0, 1.0);
  output.position = vec4f(finalPosition.xy, 0.0, 1.0);

  // Frustum cull: skip points whose sprite is entirely offscreen.
  let cullMargin = 2.0 * vec2f(drawVertex.maxPointSize) / drawVertex.screenSize;
  if (abs(output.position.x) > 1.0 + cullMargin.x || abs(output.position.y) > 1.0 + cullMargin.y) {
    output.position = vec4f(2.0, 2.0, 2.0, 1.0);
    // TODO WebGPU: gl_PointSize = 0.0;
    return output;
  }

  // Calculate sizes for shape and image
  let shapeSizeValue = calculatePointSize(input.size * drawVertex.sizeScale);
  let imageSizeValue = calculatePointSize(input.imageSize * drawVertex.sizeScale);

  // Use the larger of the two sizes for the overall point size
  var overallSizeValue = max(shapeSizeValue, imageSizeValue);

  // Scale up point sprite to fit outline ring; clamp to hardware gl_PointSize limit.
  if (output.isOutlined > 0.0) {
    overallSizeValue = overallSizeValue * outlineRingScale;
    overallSizeValue = min(overallSizeValue, drawVertex.maxPointSize * drawVertex.ratio);
  }

  // Hard-skip rendering when the final sprite size is below the configured threshold.
  if (drawVertex.pointMinPixelSize > 0.0 && overallSizeValue < drawVertex.pointMinPixelSize) {
    output.position = vec4f(2.0, 2.0, 2.0, 1.0);
    // TODO WebGPU: gl_PointSize = 0.0;
    return output;
  }

  // TODO WebGPU: gl_PointSize = overallSizeValue;
  // WGSL has no gl_PointSize; WebGPU point primitives render at 1px.
  // Engine fix: emulate via instanced quads. Until then we still pass the
  // intended size to the fragment shader so SDF maths remains consistent
  // once point-coords are real (the fragment shader will currently sample at
  // the centre of a 1px point — see fragment notes).

  // Pass size information to fragment shader
  output.shapeSize = shapeSizeValue;
  output.imageSizeVarying = imageSizeValue;
  output.overallSize = overallSizeValue;

  var shapeColor = input.color;
  output.pointShape = input.shape;

  // Adjust color of greyed-out points
  if (output.isGreyedOut > 0.0) {
    if (drawVertex.greyoutColor[0] != -1.0) {
      shapeColor = drawVertex.greyoutColor;
    } else {
      let blendFactor: f32 = 0.65;
      if (drawVertex.isDarkenGreyout > 0.0) {
        shapeColor = vec4f(mix(shapeColor.rgb, vec3f(0.2), blendFactor), shapeColor.a);
      } else {
        shapeColor = vec4f(
          mix(shapeColor.rgb, max(drawVertex.backgroundColor.rgb, vec3f(0.8)), blendFactor),
          shapeColor.a,
        );
      }
    }
  }
  output.shapeColor = shapeColor;

  if (drawVertex.hasImages <= 0.0 || input.imageIndex < 0.0 || input.imageIndex >= drawVertex.imageCount) {
    output.imageAtlasUV = vec4f(-1.0);
  } else {
    let atlasCoordIndex = input.imageIndex;
    let atlasTexSize = drawVertex.imageAtlasCoordsTextureSize;
    let texX = atlasCoordIndex - atlasTexSize * floor(atlasCoordIndex / atlasTexSize);
    let texY = floor(atlasCoordIndex / atlasTexSize);
    let atlasCoordTexCoord = (vec2f(texX, texY) + vec2f(0.5)) / atlasTexSize;
    let atlasCoords = textureSampleLevel(imageAtlasCoords, imageAtlasCoordsSampler, atlasCoordTexCoord, 0.0);
    output.imageAtlasUV = atlasCoords;
  }

  return output;
}

// ---------- Fragment shader ----------

// Smoothing controls the smoothness of the point's edge
const smoothingConst: f32 = 0.9;

// Shape constants
const CIRCLE: f32 = 0.0;
const SQUARE: f32 = 1.0;
const TRIANGLE: f32 = 2.0;
const DIAMOND: f32 = 3.0;
const PENTAGON: f32 = 4.0;
const HEXAGON: f32 = 5.0;
const STAR: f32 = 6.0;
const CROSS: f32 = 7.0;
const NONE: f32 = 8.0;

fn circleDistance(p: vec2f) -> f32 {
  return dot(p, p);
}

// Function to apply greyout logic to image colors
fn applyGreyoutToImage(imageColor: vec4f, isGreyedOutValue: f32) -> vec4f {
  var finalColor = imageColor.rgb;
  let finalAlpha = imageColor.a;

  if (isGreyedOutValue > 0.0) {
    let blendFactor: f32 = 0.65;
    if (drawFragment.isDarkenGreyout > 0.0) {
      finalColor = mix(finalColor, vec3f(0.2), blendFactor);
    } else {
      finalColor = mix(finalColor, max(drawFragment.backgroundColor.rgb, vec3f(0.8)), blendFactor);
    }
  }

  return vec4f(finalColor, finalAlpha);
}

fn squareDistance(p: vec2f) -> f32 {
  let d = abs(p) - vec2f(0.8);
  return length(max(d, vec2f(0.0))) + min(max(d.x, d.y), 0.0);
}

fn triangleDistance(pIn: vec2f) -> f32 {
  let k: f32 = sqrt(3.0); // slope of 60 degree lines for an equilateral triangle
  var p = pIn;
  p.x = abs(p.x) - 0.9;
  p.y = p.y + 0.55;

  // reflect points that fall outside the main triangle back inside
  if (p.x + k * p.y > 0.0) {
    p = vec2f(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  }

  p.x = p.x - clamp(p.x, -1.0, 0.0);

  // Return signed distance: negative = inside; positive = outside
  return -length(p) * sign(p.y);
}

fn diamondDistance(p: vec2f) -> f32 {
  // aspect > 1 -> taller diamond
  let aspect: f32 = 1.2;
  return abs(p.x) + abs(p.y) / aspect - 0.8;
}

fn pentagonDistance(pIn: vec2f) -> f32 {
  // Regular pentagon signed-distance (Inigo Quilez)
  let k = vec3f(0.809016994, 0.587785252, 0.726542528);
  var p = pIn;
  p.x = abs(p.x);

  // Reflect across the two tilted edges only if point is outside
  p = p - 2.0 * min(dot(vec2f(-k.x, k.y), p), 0.0) * vec2f(-k.x, k.y);
  p = p - 2.0 * min(dot(vec2f( k.x, k.y), p), 0.0) * vec2f( k.x, k.y);

  // Clip against the top horizontal edge (keeps top point sharp)
  p = p - vec2f(clamp(p.x, -k.z * k.x, k.z * k.x), k.z);

  return length(p) * sign(p.y);
}

fn hexagonDistance(pIn: vec2f) -> f32 {
  let k = vec3f(-0.866025404, 0.5, 0.577350269);
  var p = abs(pIn);
  p = p - 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p = p - vec2f(clamp(p.x, -k.z * 0.8, k.z * 0.8), 0.8);
  return length(p) * sign(p.y);
}

fn starDistance(pIn: vec2f) -> f32 {
  // 5-point star signed-distance function (adapted from Inigo Quilez)
  let r: f32 = 0.9;
  let rf: f32 = 0.45;

  // Pre-computed rotation vectors for the star arms (36 degree increments)
  let k1 = vec2f(0.809016994, -0.587785252);
  let k2 = vec2f(-k1.x, k1.y);

  var p = pIn;
  // Fold the plane into a single arm sector
  p.x = abs(p.x);
  p = p - 2.0 * max(dot(k1, p), 0.0) * k1;
  p = p - 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);

  // Translate so the top tip of the star lies on the X-axis
  p.y = p.y - r;

  let ba = rf * vec2f(-k1.y, k1.x) - vec2f(0.0, 1.0);
  let h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);

  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}

fn crossDistance(pIn: vec2f) -> f32 {
  // Signed distance function for a cross (union of two rectangles), Inigo Quilez
  var p = abs(pIn);
  if (p.y > p.x) {
    p = p.yx;
  }

  let q = p - vec2f(0.8, 0.3); // half-sizes: length, thickness

  // Standard rectangle SDF, then take union of the two arms
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0);
}

fn getShapeDistance(p: vec2f, shape: f32) -> f32 {
  if (shape == SQUARE) { return squareDistance(p); }
  else if (shape == TRIANGLE) { return triangleDistance(p); }
  else if (shape == DIAMOND) { return diamondDistance(p); }
  else if (shape == PENTAGON) { return pentagonDistance(p); }
  else if (shape == HEXAGON) { return hexagonDistance(p); }
  else if (shape == STAR) { return starDistance(p); }
  else if (shape == CROSS) { return crossDistance(p); }
  else { return circleDistance(p); }
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  // Discard the fragment if the point is fully transparent and has no image
  if (input.shapeColor.a == 0.0 && input.imageAtlasUV.x == -1.0) {
    discard;
  }

  // Discard the fragment if the point has no shape and no image
  if (input.pointShape == NONE && input.imageAtlasUV.x == -1.0) {
    discard;
  }

  // TODO WebGPU: gl_PointCoord has no WGSL equivalent. WebGPU point-list
  // primitives are 1px so a real point-coord would always be ~(0.5, 0.5)
  // and the SDF coordinate `pointCoord` below would always be vec2f(0.0).
  // Engine fix: render via instanced quads and pass a real (u,v) varying.
  // Until then we draw a single centred sample of every shape/image, which
  // is enough to keep the pipeline alive and the colour valid.
  let pointCoordCenter = vec2f(0.5);
  let pointCoord = 2.0 * pointCoordCenter - vec2f(1.0); // = vec2f(0.0)

  var finalShapeColor = vec4f(0.0);
  var finalImageColor = vec4f(0.0);

  // Handle shape rendering with centering logic
  if (input.pointShape != NONE) {
    var shapeCoord = pointCoord;
    if (input.overallSize > input.shapeSize && input.shapeSize > 0.0) {
      let scale = input.shapeSize / input.overallSize;
      shapeCoord = pointCoord / scale;
    }

    var opacity: f32;
    if (input.pointShape == CIRCLE) {
      let pointCenterDistance = dot(shapeCoord, shapeCoord);
      opacity = 1.0 - smoothstep(smoothingConst, 1.0, pointCenterDistance);
    } else {
      let shapeDistance = getShapeDistance(shapeCoord, input.pointShape);
      opacity = 1.0 - smoothstep(-0.01, 0.01, shapeDistance);
    }
    opacity = opacity * input.shapeColor.a;

    finalShapeColor = vec4f(input.shapeColor.rgb, opacity);
  }

  // Handle image rendering with centering logic
  if (input.imageAtlasUV.x != -1.0) {
    var imageCoord = pointCoord;
    if (input.overallSize > input.imageSizeVarying && input.imageSizeVarying > 0.0) {
      let scale = input.imageSizeVarying / input.overallSize;
      imageCoord = pointCoord / scale;

      if (abs(imageCoord.x) > 1.0 || abs(imageCoord.y) > 1.0) {
        finalImageColor = vec4f(0.0);
      } else {
        let atlasUV = mix(input.imageAtlasUV.xy, input.imageAtlasUV.zw, (imageCoord + vec2f(1.0)) * 0.5);
        let imageColor = textureSample(imageAtlasTexture, imageAtlasSampler, atlasUV);
        finalImageColor = applyGreyoutToImage(imageColor, input.isGreyedOut);
      }
    } else {
      let atlasUV = mix(input.imageAtlasUV.xy, input.imageAtlasUV.zw, (imageCoord + vec2f(1.0)) * 0.5);
      let imageColor = textureSample(imageAtlasTexture, imageAtlasSampler, atlasUV);
      finalImageColor = applyGreyoutToImage(imageColor, input.isGreyedOut);
    }
  }

  var finalPointAlpha = max(finalShapeColor.a, finalImageColor.a);
  if (input.isGreyedOut > 0.0 && drawFragment.greyoutOpacity != -1.0) {
    finalPointAlpha = finalPointAlpha * drawFragment.greyoutOpacity;
  } else {
    finalPointAlpha = finalPointAlpha * drawFragment.pointOpacity;
  }

  // Blend image color above point color
  var fragColor = vec4f(
    mix(finalShapeColor.rgb, finalImageColor.rgb, finalImageColor.a),
    finalPointAlpha,
  );

  // Render outline ring around the point
  if (input.isOutlined > 0.0) {
    let r = length(pointCoord);
    let ringSmoothing: f32 = 1.025;
    let rSafe = max(r, 1e-6);
    let wSafe = max(drawFragment.outlineWidth, 1e-6);
    let outerEdge = smoothstep(rSafe, rSafe * ringSmoothing, 1.0);
    let innerEdge = smoothstep(wSafe, wSafe * ringSmoothing, r);
    let ringAlpha = outerEdge * innerEdge;

    // Grey out the ring color when the point is greyed
    var ringColor = drawFragment.outlineColor.rgb;
    if (input.isGreyedOut > 0.0) {
      let blendFactor: f32 = 0.65;
      if (drawFragment.isDarkenGreyout > 0.0) {
        ringColor = mix(ringColor, vec3f(0.2), blendFactor);
      } else {
        ringColor = mix(ringColor, max(drawFragment.backgroundColor.rgb, vec3f(0.8)), blendFactor);
      }
    }

    let ringOpacity = ringAlpha * drawFragment.outlineColor.a;
    // Composite ring on top of existing fragment
    fragColor = vec4f(
      mix(fragColor.rgb, ringColor, ringOpacity),
      max(fragColor.a, ringOpacity),
    );
  }

  return fragColor;
}
