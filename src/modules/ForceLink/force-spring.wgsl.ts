export function forceSpringWgsl (maxLinks: number): string {
  return `// WGSL counterpart to force-spring (GLSL template) + Shared/quad.vert.
// One file, both entry points, used when useWebGPU = true.

struct ForceLinkUniforms {
  linkSpring: f32,
  linkDistance: f32,
  linkDistRandomVariationRange: vec2f,
  pointsTextureSize: f32,
  linksTextureSize: f32,
  alpha: f32,
};

@group(0) @binding(0) var<uniform> forceLink: ForceLinkUniforms;
@group(0) @binding(1) var positionsTexture: texture_2d<f32>;
@group(0) @binding(2) var positionsSampler: sampler;
@group(0) @binding(3) var linkInfoTexture: texture_2d<f32>;
@group(0) @binding(4) var linkInfoSampler: sampler;
@group(0) @binding(5) var linkIndicesTexture: texture_2d<f32>;
@group(0) @binding(6) var linkIndicesSampler: sampler;
@group(0) @binding(7) var linkPropertiesTexture: texture_2d<f32>;
@group(0) @binding(8) var linkPropertiesSampler: sampler;
@group(0) @binding(9) var linkRandomDistanceTexture: texture_2d<f32>;
@group(0) @binding(10) var linkRandomDistanceSampler: sampler;

struct VertexInput {
  @location(0) vertexCoord: vec2f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) textureCoords: vec2f,
};

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  // [-1, 1] NDC -> [0, 1] texture coords
  output.textureCoords = (input.vertexCoord + vec2f(1.0)) * 0.5;
  output.position = vec4f(input.vertexCoord, 0.0, 1.0);
  return output;
}

const MAX_LINKS: f32 = ${maxLinks}.0;

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let pointPosition = textureSample(positionsTexture, positionsSampler, input.textureCoords);
  var velocity = vec4f(0.0);

  let linkInfo = textureSample(linkInfoTexture, linkInfoSampler, input.textureCoords);
  var iCount: f32 = linkInfo.r;
  var jCount: f32 = linkInfo.g;
  let linkAmount: f32 = linkInfo.b;

  if (linkAmount > 0.0) {
    for (var i: f32 = 0.0; i < MAX_LINKS; i = i + 1.0) {
      if (i < linkAmount) {
        if (iCount >= forceLink.linksTextureSize) {
          iCount = 0.0;
          jCount = jCount + 1.0;
        }
        let linkTextureIndex = (vec2f(iCount, jCount) + 0.5) / forceLink.linksTextureSize;
        let connectedPointIndex = textureSample(linkIndicesTexture, linkIndicesSampler, linkTextureIndex);
        let biasAndStrength = textureSample(linkPropertiesTexture, linkPropertiesSampler, linkTextureIndex);
        let randomMinDistance = textureSample(linkRandomDistanceTexture, linkRandomDistanceSampler, linkTextureIndex);
        let bias = biasAndStrength.r;
        let strength = biasAndStrength.g;
        var randomMinLinkDist = randomMinDistance.r * (forceLink.linkDistRandomVariationRange.g - forceLink.linkDistRandomVariationRange.r) + forceLink.linkDistRandomVariationRange.r;
        randomMinLinkDist = randomMinLinkDist * forceLink.linkDistance;

        iCount = iCount + 1.0;

        let connectedPointPosition = textureSample(positionsTexture, positionsSampler, (connectedPointIndex.rg + 0.5) / forceLink.pointsTextureSize);
        var x = connectedPointPosition.x - (pointPosition.x + velocity.x);
        var y = connectedPointPosition.y - (pointPosition.y + velocity.y);
        var l = sqrt(x * x + y * y);

        // Apply the link force
        l = max(l, randomMinLinkDist * 0.99);
        l = (l - randomMinLinkDist) / l;
        l = l * forceLink.linkSpring * forceLink.alpha;
        l = l * strength;
        l = l * bias;
        x = x * l;
        y = y * l;
        velocity = vec4f(velocity.x + x, velocity.y + y, velocity.z, velocity.w);
      }
    }
  }

  return vec4f(velocity.rg, 0.0, 0.0);
}
`
}
