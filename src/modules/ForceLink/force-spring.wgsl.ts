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
// Packed link-attribute bundle: replaces three previously-separate textures
// (indices / bias-strength / random-distance). Layout per texel:
//   .r = connectedPointIndex.x  (texel coord into positionsTexture)
//   .g = connectedPointIndex.y
//   .b = bias * strength        (pre-multiplied CPU-side)
//   .a = random ∈ [0, 1]        (randomized link-rest-length factor)
// Accessed via textureLoad (integer coords, no sampler) so no sampler
// binding pairs with this texture.
@group(0) @binding(5) var linkBundleTexture: texture_2d<f32>;

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
        // textureLoad: integer-coord fetch, no sampler hardware path. The
        // link textures are 1:1 addressable (we always read the exact texel
        // at the link's index) so filtering buys nothing.
        let bundle = textureLoad(linkBundleTexture, vec2<i32>(i32(iCount), i32(jCount)), 0);
        let biasStrength = bundle.b;
        var randomMinLinkDist = bundle.a * (forceLink.linkDistRandomVariationRange.g - forceLink.linkDistRandomVariationRange.r) + forceLink.linkDistRandomVariationRange.r;
        randomMinLinkDist = randomMinLinkDist * forceLink.linkDistance;

        iCount = iCount + 1.0;

        // textureLoad with integer coords pulled directly from bundle.rg.
        // No UV-recompute, no sampler hardware path.
        let connectedPointPosition = textureLoad(positionsTexture, vec2<i32>(i32(bundle.r), i32(bundle.g)), 0);
        var x = connectedPointPosition.x - (pointPosition.x + velocity.x);
        var y = connectedPointPosition.y - (pointPosition.y + velocity.y);
        var l = sqrt(x * x + y * y);

        // Apply the link force
        l = max(l, randomMinLinkDist * 0.99);
        l = (l - randomMinLinkDist) / l;
        l = l * forceLink.linkSpring * forceLink.alpha;
        l = l * biasStrength;
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
