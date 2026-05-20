export const drawPointsFragmentShapesWgsl = `// ---------- Fragment shader ----------

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
}`
