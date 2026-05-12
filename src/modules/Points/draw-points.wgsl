// WGSL counterpart to draw-points.vert + draw-points.frag.
// One file, both entry points, used when useWebGPU = true.
//
// WebGPU has no gl_PointSize / gl_PointCoord, so each point is rendered as a
// 4-vertex triangle-strip instance. `quadCorner` covers [-1,1]^2 and doubles
// as the SDF coordinate the fragment shader needs.

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
};

struct DrawFragmentUniforms {
  greyoutOpacity: f32,
  pointOpacity: f32,
  isDarkenGreyout: f32,
  backgroundColor: vec4<f32>,
  outlineColor: vec4<f32>,
  outlineWidth: f32,
};

@group(0) @binding(0) var<uniform> drawVertex: DrawVertexUniforms;
@group(0) @binding(1) var<uniform> drawFragment: DrawFragmentUniforms;
// Vertex-pulling: positions live in a storage buffer indexed by instance.
// Replaces textureSampleLevel(positionsTexture, ...) — that path costs
// ~750ms/frame at n=100k due to vertex-stage texture sampling on Apple TBDR.
@group(0) @binding(2) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(3) var pointStatus: texture_2d<f32>;
@group(0) @binding(4) var pointStatusSampler: sampler;
@group(0) @binding(5) var imageAtlasTexture: texture_2d<f32>;
@group(0) @binding(6) var imageAtlasTextureSampler: sampler;
@group(0) @binding(7) var imageAtlasCoords: texture_2d<f32>;
@group(0) @binding(8) var imageAtlasCoordsSampler: sampler;

struct VertexInput {
  @location(0) quadCorner: vec2<f32>,
  @location(1) pointIndices: vec2<f32>,
  @location(2) size: f32,
  @location(3) color: vec4<f32>,
  @location(4) shape: f32,
  @location(5) imageIndex: f32,
  @location(6) imageSize: f32,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) pointShape: f32,
  @location(1) isGreyedOut: f32,
  @location(2) isOutlined: f32,
  @location(3) shapeColor: vec4<f32>,
  @location(4) imageAtlasUV: vec4<f32>,
  @location(5) shapeSize: f32,
  @location(6) imageSizeVarying: f32,
  @location(7) overallSize: f32,
  @location(8) pointCoord: vec2<f32>,
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
fn vertexMain(input: VertexInput, @builtin(instance_index) instanceIdx: u32) -> VertexOutput {
  var output: VertexOutput;
  output.pointShape = 0.0;
  output.isGreyedOut = 0.0;
  output.isOutlined = 0.0;
  output.shapeColor = vec4<f32>(0.0);
  output.imageAtlasUV = vec4<f32>(-1.0);
  output.shapeSize = 0.0;
  output.imageSizeVarying = 0.0;
  output.overallSize = 0.0;

  let uv = (input.pointIndices + vec2<f32>(0.5)) / drawVertex.pointsTextureSize;

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
    output.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
    return output;
  }
  if (drawVertex.skipGreyed > 0.0 && isHighlighted <= 0.0) {
    output.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
    return output;
  }

  // Position via storage-buffer vertex-pulling. The sim writes
  // currentPositionTexture; renderFrame copies it to `positions` once per
  // frame before draw. Indexing by instance avoids per-vertex texture sampling.
  let pointPosition = positions[instanceIdx];
  let point = pointPosition.rg;

  // Transform point position to normalized device coordinates
  var normalizedPosition = 2.0 * point / drawVertex.spaceSize - vec2<f32>(1.0);
  normalizedPosition = normalizedPosition * (drawVertex.spaceSize / drawVertex.screenSize);

  // Equivalent to mat3(transformationMatrix) * vec3(normalizedPosition, 1)
  let finalPosition = drawVertex.transformationMatrix * vec4<f32>(normalizedPosition, 1.0, 1.0);
  let centerClip = vec2<f32>(finalPosition.xy);

  // Frustum cull: skip points whose sprite is entirely offscreen.
  let cullMargin = 2.0 * vec2<f32>(drawVertex.maxPointSize) / drawVertex.screenSize;
  if (abs(centerClip.x) > 1.0 + cullMargin.x || abs(centerClip.y) > 1.0 + cullMargin.y) {
    output.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
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
    output.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
    return output;
  }

  // Expand the instance into a screen-aligned quad. quadCorner is [-1,1]^2;
  // half-extent in clip space is sizePx / framebufferSize, and framebufferSize
  // = screenSize * ratio (screenSize is CSS pixels, sizes are device pixels).
  let halfExtentClip = vec2<f32>(
    overallSizeValue / (drawVertex.screenSize.x * drawVertex.ratio),
    overallSizeValue / (drawVertex.screenSize.y * drawVertex.ratio),
  );
  output.position = vec4<f32>(centerClip + input.quadCorner * halfExtentClip, 0.0, 1.0);
  output.pointCoord = input.quadCorner;

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

  if (drawVertex.hasImages <= 0.0 || input.imageIndex < 0.0 || input.imageIndex >= drawVertex.imageCount) {
    output.imageAtlasUV = vec4<f32>(-1.0);
  } else {
    let atlasCoordIndex = input.imageIndex;
    let atlasTexSize = drawVertex.imageAtlasCoordsTextureSize;
    let texX = atlasCoordIndex - atlasTexSize * floor(atlasCoordIndex / atlasTexSize);
    let texY = floor(atlasCoordIndex / atlasTexSize);
    let atlasCoordTexCoord = (vec2<f32>(texX, texY) + vec2<f32>(0.5)) / atlasTexSize;
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

fn circleDistance(p: vec2<f32>) -> f32 {
  return dot(p, p);
}

// Function to apply greyout logic to image colors
fn applyGreyoutToImage(imageColor: vec4<f32>, isGreyedOutValue: f32) -> vec4<f32> {
  var finalColor = imageColor.rgb;
  let finalAlpha = imageColor.a;

  if (isGreyedOutValue > 0.0) {
    let blendFactor: f32 = 0.65;
    if (drawFragment.isDarkenGreyout > 0.0) {
      finalColor = mix(finalColor, vec3<f32>(0.2), blendFactor);
    } else {
      finalColor = mix(finalColor, max(drawFragment.backgroundColor.rgb, vec3<f32>(0.8)), blendFactor);
    }
  }

  return vec4<f32>(finalColor, finalAlpha);
}

fn squareDistance(p: vec2<f32>) -> f32 {
  let d = abs(p) - vec2<f32>(0.8);
  return length(max(d, vec2<f32>(0.0))) + min(max(d.x, d.y), 0.0);
}

fn triangleDistance(pIn: vec2<f32>) -> f32 {
  let k: f32 = sqrt(3.0); // slope of 60 degree lines for an equilateral triangle
  var p = pIn;
  p.x = abs(p.x) - 0.9;
  p.y = p.y + 0.55;

  // reflect points that fall outside the main triangle back inside
  if (p.x + k * p.y > 0.0) {
    p = vec2<f32>(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  }

  p.x = p.x - clamp(p.x, -1.0, 0.0);

  // Return signed distance: negative = inside; positive = outside
  return -length(p) * sign(p.y);
}

fn diamondDistance(p: vec2<f32>) -> f32 {
  // aspect > 1 -> taller diamond
  let aspect: f32 = 1.2;
  return abs(p.x) + abs(p.y) / aspect - 0.8;
}

fn pentagonDistance(pIn: vec2<f32>) -> f32 {
  // Regular pentagon signed-distance (Inigo Quilez)
  let k = vec3<f32>(0.809016994, 0.587785252, 0.726542528);
  var p = pIn;
  p.x = abs(p.x);

  // Reflect across the two tilted edges only if point is outside
  p = p - 2.0 * min(dot(vec2<f32>(-k.x, k.y), p), 0.0) * vec2<f32>(-k.x, k.y);
  p = p - 2.0 * min(dot(vec2<f32>( k.x, k.y), p), 0.0) * vec2<f32>( k.x, k.y);

  // Clip against the top horizontal edge (keeps top point sharp)
  p = p - vec2<f32>(clamp(p.x, -k.z * k.x, k.z * k.x), k.z);

  return length(p) * sign(p.y);
}

fn hexagonDistance(pIn: vec2<f32>) -> f32 {
  let k = vec3<f32>(-0.866025404, 0.5, 0.577350269);
  var p = abs(pIn);
  p = p - 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p = p - vec2<f32>(clamp(p.x, -k.z * 0.8, k.z * 0.8), 0.8);
  return length(p) * sign(p.y);
}

fn starDistance(pIn: vec2<f32>) -> f32 {
  // 5-point star signed-distance function (adapted from Inigo Quilez)
  let r: f32 = 0.9;
  let rf: f32 = 0.45;

  // Pre-computed rotation vectors for the star arms (36 degree increments)
  let k1 = vec2<f32>(0.809016994, -0.587785252);
  let k2 = vec2<f32>(-k1.x, k1.y);

  var p = pIn;
  // Fold the plane into a single arm sector
  p.x = abs(p.x);
  p = p - 2.0 * max(dot(k1, p), 0.0) * k1;
  p = p - 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);

  // Translate so the top tip of the star lies on the X-axis
  p.y = p.y - r;

  let ba = rf * vec2<f32>(-k1.y, k1.x) - vec2<f32>(0.0, 1.0);
  let h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);

  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}

fn crossDistance(pIn: vec2<f32>) -> f32 {
  // Signed distance function for a cross (union of two rectangles), Inigo Quilez
  var p = abs(pIn);
  if (p.y > p.x) {
    p = p.yx;
  }

  let q = p - vec2<f32>(0.8, 0.3); // half-sizes: length, thickness

  // Standard rectangle SDF, then take union of the two arms
  return length(max(q, vec2<f32>(0.0))) + min(max(q.x, q.y), 0.0);
}

fn getShapeDistance(p: vec2<f32>, shape: f32) -> f32 {
  if (shape == SQUARE) { return squareDistance(p); }
  else if (shape == TRIANGLE) { return triangleDistance(p); }
  else if (shape == DIAMOND) { return diamondDistance(p); }
  else if (shape == PENTAGON) { return pentagonDistance(p); }
  else if (shape == HEXAGON) { return hexagonDistance(p); }
  else if (shape == STAR) { return starDistance(p); }
  else if (shape == CROSS) { return crossDistance(p); }
  else { return circleDistance(p); }
}

// LOD 0: textureSample isn't allowed under the non-uniform control flow we
// enter via shape/image branches; textureSampleLevel sidesteps that rule.
fn sampleAtlas(uv: vec2<f32>) -> vec4<f32> {
  return textureSampleLevel(imageAtlasTexture, imageAtlasTextureSampler, uv, 0.0);
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  // Discard the fragment if the point is fully transparent and has no image
  if (input.shapeColor.a == 0.0 && input.imageAtlasUV.x == -1.0) {
    discard;
  }

  // Discard the fragment if the point has no shape and no image
  if (input.pointShape == NONE && input.imageAtlasUV.x == -1.0) {
    discard;
  }

  let pointCoord = input.pointCoord;

  // Fast corner-cull for the common no-image circle case. The quad we draw
  // is 2×2 in unit-coord space, but only the inscribed disk (r ≤ 1) is
  // visible. The four corners cover ~21% of the quad footprint and would
  // otherwise burn the full fragment shader (shape distance, fwidth,
  // smoothstep, outline ring math) to produce zero opacity. Discard them
  // immediately. The 1.05² margin keeps the analytic AA edge intact even
  // for the smallest points where one device pixel may extend slightly
  // past r=1; the outline path is excluded because the ring lives outside
  // the disk.
  let rSq = pointCoord.x * pointCoord.x + pointCoord.y * pointCoord.y;
  if (input.pointShape == CIRCLE && input.imageAtlasUV.x == -1.0 && input.isOutlined == 0.0 && rSq > 1.1025) {
    discard;
  }

  // Analytic AA: signed distance from shape edge in unit-coord space.
  // fwidth() must be called in uniform control flow per WGSL spec, so the
  // distance is computed unconditionally at the top of the fragment. The
  // shape branch below just gates whether we use it.
  var shapeCoordForAA = pointCoord;
  if (input.overallSize > input.shapeSize && input.shapeSize > 0.0) {
    let scale = input.shapeSize / input.overallSize;
    shapeCoordForAA = pointCoord / scale;
  }
  let distCircle = length(shapeCoordForAA) - 1.0;
  let distShape = getShapeDistance(shapeCoordForAA, input.pointShape);
  let isCircle = select(0.0, 1.0, input.pointShape == CIRCLE);
  let dAA = mix(distShape, distCircle, isCircle);
  let aaWidth = max(fwidth(dAA), 1e-4);
  let shapeOpacity = 1.0 - smoothstep(-aaWidth, aaWidth, dAA);

  var finalShapeColor = vec4<f32>(0.0);
  var finalImageColor = vec4<f32>(0.0);

  // Handle shape rendering with centering logic
  if (input.pointShape != NONE) {
    finalShapeColor = vec4<f32>(input.shapeColor.rgb, shapeOpacity * input.shapeColor.a);
  }

  // Handle image rendering with centering logic
  if (input.imageAtlasUV.x != -1.0) {
    var imageCoord = pointCoord;
    if (input.overallSize > input.imageSizeVarying && input.imageSizeVarying > 0.0) {
      let scale = input.imageSizeVarying / input.overallSize;
      imageCoord = pointCoord / scale;

      if (abs(imageCoord.x) > 1.0 || abs(imageCoord.y) > 1.0) {
        finalImageColor = vec4<f32>(0.0);
      } else {
        let atlasUV = mix(input.imageAtlasUV.xy, input.imageAtlasUV.zw, (imageCoord + vec2<f32>(1.0)) * 0.5);
        finalImageColor = applyGreyoutToImage(sampleAtlas(atlasUV), input.isGreyedOut);
      }
    } else {
      let atlasUV = mix(input.imageAtlasUV.xy, input.imageAtlasUV.zw, (imageCoord + vec2<f32>(1.0)) * 0.5);
      finalImageColor = applyGreyoutToImage(sampleAtlas(atlasUV), input.isGreyedOut);
    }
  }

  var finalPointAlpha = max(finalShapeColor.a, finalImageColor.a);
  if (input.isGreyedOut > 0.0 && drawFragment.greyoutOpacity != -1.0) {
    finalPointAlpha = finalPointAlpha * drawFragment.greyoutOpacity;
  } else {
    finalPointAlpha = finalPointAlpha * drawFragment.pointOpacity;
  }

  // Blend image color above point color
  var fragColor = vec4<f32>(
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
        ringColor = mix(ringColor, vec3<f32>(0.2), blendFactor);
      } else {
        ringColor = mix(ringColor, max(drawFragment.backgroundColor.rgb, vec3<f32>(0.8)), blendFactor);
      }
    }

    let ringOpacity = ringAlpha * drawFragment.outlineColor.a;
    // Composite ring on top of existing fragment
    fragColor = vec4<f32>(
      mix(fragColor.rgb, ringColor, ringOpacity),
      max(fragColor.a, ringOpacity),
    );
  }

  // Premultiplied alpha: pair with blend (one, one-minus-src-alpha). Stacks
  // of translucent nodes composite correctly without dark halos. Equivalent
  // math to alpha-over when used with the correct blend factors.
  return vec4<f32>(fragColor.rgb * fragColor.a, fragColor.a);
}
