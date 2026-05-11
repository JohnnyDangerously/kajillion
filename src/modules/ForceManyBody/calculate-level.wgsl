// WGSL counterpart to calculate-level.vert + calculate-level.frag.
// One file, both entry points, used when useWebGPU = true.
//
// Custom vertex shader: one vertex per point (topology: 'point-list').
// Each vertex reads its world-space position from positionsTexture and
// projects to the quadtree-level grid cell that contains it.

struct CalculateLevelsUniforms {
  pointsTextureSize: f32,
  levelTextureSize: f32,
  cellSize: f32,
};

@group(0) @binding(0) var<uniform> calculateLevels: CalculateLevelsUniforms;
@group(0) @binding(1) var positionsTexture: texture_2d<f32>;
@group(0) @binding(2) var positionsSampler: sampler;

struct VertexInput {
  @location(0) pointIndices: vec2f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) vColor: vec4f,
};

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  let pointPosition = textureSampleLevel(
    positionsTexture,
    positionsSampler,
    input.pointIndices / calculateLevels.pointsTextureSize,
    0.0,
  );
  output.vColor = vec4f(pointPosition.rg, 1.0, 0.0);

  let n = floor(pointPosition.x / calculateLevels.cellSize);
  let m = floor(pointPosition.y / calculateLevels.cellSize);

  let levelPosition = 2.0 * (vec2f(n, m) + 0.5) / calculateLevels.levelTextureSize - 1.0;

  output.position = vec4f(levelPosition, 0.0, 1.0);
  // NOTE: GLSL sets gl_PointSize = 1.0; WebGPU point primitives are always size 1.
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  return input.vColor;
}
