export function forceSpringWgsl (maxLinks: number): string {
  return `// WGSL counterpart to force-spring (GLSL template) + Shared/quad.vert.
// One file, both entry points, used when useWebGPU = true.

struct ForceLinkUniforms {
  linkSpring: f32,
  linkDistance: f32,
  linkDistRandomVariationRange: vec2<f32>,
  pointsTextureSize: f32,
  linksTextureSize: f32,
  alpha: f32,
};

@group(0) @binding(0) var<uniform> forceLink: ForceLinkUniforms;
@group(0) @binding(1) var positionsTexture: texture_2d<f32>;
@group(0) @binding(2) var positionsTextureSampler: sampler;
@group(0) @binding(3) var linkInfoTexture: texture_2d<f32>;
@group(0) @binding(4) var linkInfoTextureSampler: sampler;
@group(0) @binding(5) var linkIndicesTexture: texture_2d<f32>;
@group(0) @binding(6) var linkIndicesTextureSampler: sampler;
@group(0) @binding(7) var linkPropertiesTexture: texture_2d<f32>;
@group(0) @binding(8) var linkPropertiesTextureSampler: sampler;
@group(0) @binding(9) var linkRandomDistanceTexture: texture_2d<f32>;
@group(0) @binding(10) var linkRandomDistanceTextureSampler: sampler;

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

const MAX_LINKS: f32 = ${maxLinks}.0;

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let pointPosition = textureSampleLevel(positionsTexture, positionsTextureSampler, input.textureCoords, 0.0);
  var velocity = vec4<f32>(0.0);

  let linkInfo = textureSampleLevel(linkInfoTexture, linkInfoTextureSampler, input.textureCoords, 0.0);
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
        let linkTextureIndex = (vec2<f32>(iCount, jCount) + 0.5) / forceLink.linksTextureSize;
        let connectedPointIndex = textureSampleLevel(linkIndicesTexture, linkIndicesTextureSampler, linkTextureIndex, 0.0);
        let biasAndStrength = textureSampleLevel(linkPropertiesTexture, linkPropertiesTextureSampler, linkTextureIndex, 0.0);
        let randomMinDistance = textureSampleLevel(linkRandomDistanceTexture, linkRandomDistanceTextureSampler, linkTextureIndex, 0.0);
        let bias = biasAndStrength.r;
        let strength = biasAndStrength.g;
        var randomMinLinkDist = randomMinDistance.r * (forceLink.linkDistRandomVariationRange.g - forceLink.linkDistRandomVariationRange.r) + forceLink.linkDistRandomVariationRange.r;
        randomMinLinkDist = randomMinLinkDist * forceLink.linkDistance;

        iCount = iCount + 1.0;

        let connectedPointPosition = textureSampleLevel(positionsTexture, positionsTextureSampler, (connectedPointIndex.rg + 0.5) / forceLink.pointsTextureSize, 0.0);
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
        velocity = vec4<f32>(velocity.x + x, velocity.y + y, velocity.z, velocity.w);
      }
    }
  }

  return vec4<f32>(velocity.rg, 0.0, 0.0);
}
`
}
