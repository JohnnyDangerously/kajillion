// WGSL counterpart to force-level.frag + Shared/quad.vert.
// One file, both entry points, used when useWebGPU = true.

struct ForceUniforms {
  level: f32,
  levels: f32,
  levelTextureSize: f32,
  alpha: f32,
  repulsion: f32,
  spaceSize: f32,
  theta: f32,
};

@group(0) @binding(0) var<uniform> force: ForceUniforms;
@group(0) @binding(1) var positionsTexture: texture_2d<f32>;
@group(0) @binding(2) var positionsSampler: sampler;
@group(0) @binding(3) var levelFbo: texture_2d<f32>;
@group(0) @binding(4) var levelFboSampler: sampler;

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

const MAX_LEVELS_NUM: f32 = 14.0;

fn calculateAdditionalVelocity(ij: vec2<f32>, pp: vec2<f32>) -> vec2<f32> {
  var add = vec2<f32>(0.0);
  let centermass = textureSample(levelFbo, levelFboSampler, ij);
  if (centermass.r > 0.0 && centermass.g > 0.0 && centermass.b > 0.0) {
    let centermassPosition = centermass.rg / centermass.b;
    let distVector = pp - centermassPosition;
    var l = dot(distVector, distVector);
    let dist = sqrt(l);
    if (l > 0.0) {
      let c = force.alpha * force.repulsion * centermass.b;

      let distanceMin2: f32 = 1.0;
      if (l < distanceMin2) {
        l = sqrt(distanceMin2 * l);
      }
      let addV = c / sqrt(l);
      add = addV * normalize(distVector);
    }
  }
  return add;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let pointPosition = textureSample(positionsTexture, positionsSampler, input.textureCoords);
  let x = pointPosition.x;
  let y = pointPosition.y;

  var left: f32 = 0.0;
  var top: f32 = 0.0;
  var right: f32 = force.spaceSize;
  var bottom: f32 = force.spaceSize;

  var n_left: f32 = 0.0;
  var n_top: f32 = 0.0;
  var n_right: f32 = 0.0;
  var n_bottom: f32 = 0.0;

  var cellSize: f32 = 0.0;

  // Iterate over levels to adjust the boundaries based on the current level
  for (var i: f32 = 0.0; i < MAX_LEVELS_NUM; i = i + 1.0) {
    if (i <= force.level) {
      left = left + cellSize * n_left;
      top = top + cellSize * n_top;
      right = right - cellSize * n_right;
      bottom = bottom - cellSize * n_bottom;

      cellSize = pow(2.0, force.levels - i - 1.0);

      let dist_left = x - left;
      n_left = max(0.0, floor(dist_left / cellSize - force.theta));

      let dist_top = y - top;
      n_top = max(0.0, floor(dist_top / cellSize - force.theta));

      let dist_right = right - x;
      n_right = max(0.0, floor(dist_right / cellSize - force.theta));

      let dist_bottom = bottom - y;
      n_bottom = max(0.0, floor(dist_bottom / cellSize - force.theta));
    }
  }

  var velocity = vec4<f32>(0.0, 0.0, 1.0, 0.0);

  // Calculate the additional velocity based on neighboring cells
  for (var i: f32 = 0.0; i < 12.0; i = i + 1.0) {
    for (var j: f32 = 0.0; j < 4.0; j = j + 1.0) {
      var n = left + cellSize * j;
      var m = top + cellSize * n_top + cellSize * i;

      if (n < (left + n_left * cellSize) && m < bottom) {
        velocity = vec4<f32>(
          velocity.xy + calculateAdditionalVelocity(vec2<f32>(n / cellSize, m / cellSize) / force.levelTextureSize, pointPosition.xy),
          velocity.zw,
        );
      }

      n = left + cellSize * i;
      m = top + cellSize * j;

      if (n < (right - n_right * cellSize) && m < (top + n_top * cellSize)) {
        velocity = vec4<f32>(
          velocity.xy + calculateAdditionalVelocity(vec2<f32>(n / cellSize, m / cellSize) / force.levelTextureSize, pointPosition.xy),
          velocity.zw,
        );
      }

      n = right - n_right * cellSize + cellSize * j;
      m = top + cellSize * i;

      if (n < right && m < (bottom - n_bottom * cellSize)) {
        velocity = vec4<f32>(
          velocity.xy + calculateAdditionalVelocity(vec2<f32>(n / cellSize, m / cellSize) / force.levelTextureSize, pointPosition.xy),
          velocity.zw,
        );
      }

      n = left + n_left * cellSize + cellSize * i;
      m = bottom - n_bottom * cellSize + cellSize * j;

      if (n < right && m < bottom) {
        velocity = vec4<f32>(
          velocity.xy + calculateAdditionalVelocity(vec2<f32>(n / cellSize, m / cellSize) / force.levelTextureSize, pointPosition.xy),
          velocity.zw,
        );
      }
    }
  }

  return velocity;
}
