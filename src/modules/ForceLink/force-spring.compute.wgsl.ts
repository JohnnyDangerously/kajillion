// WebGPU compute-shader port of force-spring.
//
// The fragment-shader version (force-spring.wgsl.ts) burns ~25 ms per pass at
// n=100k on M5 Max — a full quad rasterization rebuilds the rasterizer state
// for every point and the TBDR tile binner has nothing to bin against because
// the work is independent per-texel. Compute throws away the rasterizer
// entirely: one thread per point, 8×8 workgroup tile, dispatched as ceil(n/8)²
// workgroups. No vertex shader, no fragment shader, no varyings, no blend.
//
// The body is the same as the fragment version (textureLoad-only, no samplers)
// so any per-link cost dragged onto the GPU is from the link math itself, not
// the wrapper.
//
// Output: a storage texture (rgba32float, write-only) aliasing the same GPU
// resource as the fragment path's `velocityTexture`. The downstream
// `updatePosition` pass samples it unchanged — the only change is which stage
// produced the velocity.
export function forceSpringComputeWgsl (maxLinks: number): string {
  return `
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
@group(0) @binding(2) var linkInfoTexture: texture_2d<f32>;
@group(0) @binding(3) var linkBundleTexture: texture_2d<f32>;
@group(0) @binding(4) var velocityOut: texture_storage_2d<rgba32float, write>;

const MAX_LINKS: f32 = ${maxLinks}.0;

@compute @workgroup_size(8, 8, 1)
fn computeMain(@builtin(global_invocation_id) gid: vec3<u32>) {
  let pointsSize = u32(forceLink.pointsTextureSize);
  // Guard the trailing strip when N is not a multiple of 8 in either dim.
  if (gid.x >= pointsSize || gid.y >= pointsSize) {
    return;
  }

  let coords = vec2<i32>(i32(gid.x), i32(gid.y));
  let pointPosition = textureLoad(positionsTexture, coords, 0);
  var velocity = vec2<f32>(0.0, 0.0);

  let linkInfo = textureLoad(linkInfoTexture, coords, 0);
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
        let bundle = textureLoad(linkBundleTexture, vec2<i32>(i32(iCount), i32(jCount)), 0);
        let biasStrength = bundle.b;
        var randomMinLinkDist = bundle.a * (forceLink.linkDistRandomVariationRange.g - forceLink.linkDistRandomVariationRange.r) + forceLink.linkDistRandomVariationRange.r;
        randomMinLinkDist = randomMinLinkDist * forceLink.linkDistance;

        iCount = iCount + 1.0;

        let connectedPointPosition = textureLoad(positionsTexture, vec2<i32>(i32(bundle.r), i32(bundle.g)), 0);
        var x = connectedPointPosition.x - (pointPosition.x + velocity.x);
        var y = connectedPointPosition.y - (pointPosition.y + velocity.y);
        var l = sqrt(x * x + y * y);

        // Apply the link force
        l = max(l, randomMinLinkDist * 0.99);
        l = (l - randomMinLinkDist) / l;
        l = l * forceLink.linkSpring * forceLink.alpha;
        l = l * biasStrength;
        velocity = vec2<f32>(velocity.x + x * l, velocity.y + y * l);
      }
    }
  }

  textureStore(velocityOut, coords, vec4<f32>(velocity.x, velocity.y, 0.0, 0.0));
}
`
}
