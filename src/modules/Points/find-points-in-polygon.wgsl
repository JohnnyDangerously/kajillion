// WGSL counterpart to find-points-in-polygon.frag + Shared/quad.vert.
// One file, both entry points, used when useWebGPU = true.

struct FindPointsInPolygonUniforms {
  spaceSize: f32,
  screenSize: vec2<f32>,
  transformationMatrix: mat4x4<f32>,
  polygonPathLength: f32,
};

@group(0) @binding(0) var<uniform> findPointsInPolygon: FindPointsInPolygonUniforms;
@group(0) @binding(1) var positionsTexture: texture_2d<f32>;
@group(0) @binding(2) var positionsTextureSampler: sampler;
@group(0) @binding(3) var polygonPathTexture: texture_2d<f32>;
@group(0) @binding(4) var polygonPathTextureSampler: sampler;

struct VertexInput {
  @location(0) vertexCoord: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) textureCoords: vec2<f32>,
};

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  // [-1, 1] NDC -> [0, 1] texture coords
  output.textureCoords = (input.vertexCoord + vec2<f32>(1.0)) * 0.5;
  output.position = vec4<f32>(input.vertexCoord, 0.0, 1.0);
  return output;
}

// Get a point from the polygon path texture at a specific index
fn getPolygonPoint(index: i32, pathLength: i32) -> vec2<f32> {
  if (index >= pathLength) {
    return vec2<f32>(0.0);
  }

  // Calculate texture coordinates for the index
  let textureSize = i32(ceil(sqrt(f32(pathLength))));
  let x = index - (index / textureSize) * textureSize;
  let y = index / textureSize;

  let texCoord = (vec2<f32>(f32(x), f32(y)) + 0.5) / f32(textureSize);
  let pathData = textureSample(polygonPathTexture, polygonPathTextureSampler, texCoord);

  return pathData.xy;
}

// Point-in-polygon algorithm using ray casting
fn pointInPolygon(point: vec2<f32>, pathLength: i32) -> bool {
  var inside = false;

  for (var i: i32 = 0; i < 2048; i = i + 1) {
    if (i >= pathLength) {
      break;
    }

    // (i + 1) % pathLength on i32 — well-defined for non-negative ints,
    // and safe under any future refactor that might introduce negatives
    // (unlike float `%` which is IEEE remainder, not floor mod).
    let j = (i + 1) % pathLength;

    let pi = getPolygonPoint(i, pathLength);
    let pj = getPolygonPoint(j, pathLength);

    if (((pi.y > point.y) != (pj.y > point.y)) &&
        (point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x)) {
      inside = !inside;
    }
  }

  return inside;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let pointPosition = textureSample(positionsTexture, positionsTextureSampler, input.textureCoords);
  var p = 2.0 * pointPosition.rg / findPointsInPolygon.spaceSize - vec2<f32>(1.0);
  p = p * (findPointsInPolygon.spaceSize / findPointsInPolygon.screenSize);
  let final = findPointsInPolygon.transformationMatrix * vec4<f32>(p, 1.0, 1.0);

  // Convert to screen coordinates for polygon check
  let screenPos = (final.xy + vec2<f32>(1.0)) * findPointsInPolygon.screenSize / 2.0;

  var fragColor = vec4<f32>(0.0, 0.0, pointPosition.r, pointPosition.g);

  // Check if point center is inside the polygon
  let pathLength = i32(findPointsInPolygon.polygonPathLength);
  if (pointInPolygon(screenPos, pathLength)) {
    fragColor.r = 1.0;
  }
  return fragColor;
}
