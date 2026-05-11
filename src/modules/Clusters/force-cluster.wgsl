// WGSL counterpart to force-cluster.frag + Shared/quad.vert.
// One file, both entry points, used when useWebGPU = true.

struct ApplyForcesUniforms {
  alpha: f32,
  clustersTextureSize: f32,
  clusterCoefficient: f32,
};

@group(0) @binding(0) var<uniform> applyForces: ApplyForcesUniforms;
@group(0) @binding(1) var positionsTexture: texture_2d<f32>;
@group(0) @binding(2) var positionsSampler: sampler;
@group(0) @binding(3) var centermassTexture: texture_2d<f32>;
@group(0) @binding(4) var centermassSampler: sampler;
@group(0) @binding(5) var clusterTexture: texture_2d<f32>;
@group(0) @binding(6) var clusterSampler: sampler;
@group(0) @binding(7) var clusterPositionsTexture: texture_2d<f32>;
@group(0) @binding(8) var clusterPositionsSampler: sampler;
@group(0) @binding(9) var clusterForceCoefficient: texture_2d<f32>;
@group(0) @binding(10) var clusterForceCoefficientSampler: sampler;

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

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let pointPosition = textureSample(positionsTexture, positionsSampler, input.textureCoords);
  var velocity = vec4<f32>(0.0);
  let pointClusterIndices = textureSample(clusterTexture, clusterSampler, input.textureCoords);

  // no cluster, so no forces
  if (pointClusterIndices.x >= 0.0 && pointClusterIndices.y >= 0.0) {
    // positioning points to custom cluster position or either to the center of mass
    var clusterPositions = textureSample(clusterPositionsTexture, clusterPositionsSampler, pointClusterIndices.xy / applyForces.clustersTextureSize).xy;
    if (clusterPositions.x < 0.0 || clusterPositions.y < 0.0) {
      let centermassValues = textureSample(centermassTexture, centermassSampler, pointClusterIndices.xy / applyForces.clustersTextureSize);
      clusterPositions = centermassValues.xy / centermassValues.b;
    }
    let clusterCustomCoeff = textureSample(clusterForceCoefficient, clusterForceCoefficientSampler, input.textureCoords);
    let distVector = clusterPositions.xy - pointPosition.xy;
    let dist = length(distVector);
    if (dist > 0.0) {
      let addV = applyForces.alpha * dist * applyForces.clusterCoefficient * clusterCustomCoeff.r;
      velocity = vec4<f32>(velocity.rg + addV * normalize(distVector), velocity.ba);
    }
  }

  return velocity;
}
