import {
  FORCE_MANY_BODY_VELOCITY_HELPERS_WGSL,
  forceManyBodyLevelBindings,
  forceManyBodySampleLevelCases
} from './force-many-body.compute.fragments'

export function forceManyBodyComputeWgsl (maxLevels: number): string {
  // @binding(0) uniforms, @binding(1) positions, @binding(2) randomValues,
  // @binding(3) velocityOut, @binding(4..4+maxLevels-1) levelFbo{0..N-1}.
  const levelBindings = forceManyBodyLevelBindings(maxLevels)

  // Switch statement to load from the correct level texture given a dynamic
  // level index. WGSL forbids dynamic indexing of texture bindings, but the
  // switch resolves at compile time once unrolled.
  const sampleLevelCases = forceManyBodySampleLevelCases(maxLevels)

  return `
struct ForceUniforms {
  levels: f32,
  alpha: f32,
  repulsion: f32,
  spaceSize: f32,
  theta: f32,
  pointsTextureSize: f32,
};

@group(0) @binding(0) var<uniform> force: ForceUniforms;
@group(0) @binding(1) var positionsTexture: texture_2d<f32>;
@group(0) @binding(2) var randomValues: texture_2d<f32>;
@group(0) @binding(3) var velocityOut: texture_storage_2d<rgba32float, write>;
${levelBindings}

const MAX_LEVELS: u32 = ${maxLevels}u;

fn sampleLevelTexture(level: u32, ij: vec2<i32>) -> vec4<f32> {
  switch (level) {
${sampleLevelCases}
    default: { return vec4<f32>(0.0); }
  }
}

${FORCE_MANY_BODY_VELOCITY_HELPERS_WGSL}

// Apple GPU subgroup is 32 threads; (8,4)=32 = exactly 1 subgroup, whereas
// (8,8)=64 = 2 subgroups per workgroup. Smaller groups reduce divergence
// pressure when neighboring points land in different boundary states.
@compute @workgroup_size(8, 4, 1)
fn computeMain(@builtin(global_invocation_id) gid: vec3<u32>) {
  let pointsSize = u32(force.pointsTextureSize);
  if (gid.x >= pointsSize || gid.y >= pointsSize) {
    return;
  }

  let coords = vec2<i32>(i32(gid.x), i32(gid.y));
  let pointPosition = textureLoad(positionsTexture, coords, 0);
  let x = pointPosition.x;
  let y = pointPosition.y;
  let pp = pointPosition.xy;

  var velocity = vec2<f32>(0.0, 0.0);

  // Boundary state evolves cumulatively across levels.
  var left: f32 = 0.0;
  var top: f32 = 0.0;
  var right: f32 = force.spaceSize;
  var bottom: f32 = force.spaceSize;
  var n_left: f32 = 0.0;
  var n_top: f32 = 0.0;
  var n_right: f32 = 0.0;
  var n_bottom: f32 = 0.0;
  var cellSize: f32 = 0.0;

  let levelsActive = u32(force.levels);

  for (var i: u32 = 0u; i < MAX_LEVELS; i = i + 1u) {
    if (i >= levelsActive) {
      break;
    }

    // Update boundary state using PREVIOUS iteration's cellSize.
    left = left + cellSize * n_left;
    top = top + cellSize * n_top;
    right = right - cellSize * n_right;
    bottom = bottom - cellSize * n_bottom;

    // Compute this level's cellSize and boundary counts.
    cellSize = exp2(force.levels - f32(i) - 1.0);

    let dist_left = x - left;
    n_left = max(0.0, floor(dist_left / cellSize - force.theta));
    let dist_top = y - top;
    n_top = max(0.0, floor(dist_top / cellSize - force.theta));
    let dist_right = right - x;
    n_right = max(0.0, floor(dist_right / cellSize - force.theta));
    let dist_bottom = bottom - y;
    n_bottom = max(0.0, floor(dist_bottom / cellSize - force.theta));

    // Inner 12×4 cell-iteration loop: sample cells in this level's frame.
    for (var ii: f32 = 0.0; ii < 12.0; ii = ii + 1.0) {
      for (var jj: f32 = 0.0; jj < 4.0; jj = jj + 1.0) {
        var n: f32;
        var m: f32;

        // Left strip
        n = left + cellSize * jj;
        m = top + cellSize * n_top + cellSize * ii;
        if (n < (left + n_left * cellSize) && m < bottom) {
          velocity = velocity + calculateAdditionalVelocity(
            i,
            vec2<i32>(i32(n / cellSize), i32(m / cellSize)),
            pp,
          );
        }

        // Top strip
        n = left + cellSize * ii;
        m = top + cellSize * jj;
        if (n < (right - n_right * cellSize) && m < (top + n_top * cellSize)) {
          velocity = velocity + calculateAdditionalVelocity(
            i,
            vec2<i32>(i32(n / cellSize), i32(m / cellSize)),
            pp,
          );
        }

        // Right strip
        n = right - n_right * cellSize + cellSize * jj;
        m = top + cellSize * ii;
        if (n < right && m < (bottom - n_bottom * cellSize)) {
          velocity = velocity + calculateAdditionalVelocity(
            i,
            vec2<i32>(i32(n / cellSize), i32(m / cellSize)),
            pp,
          );
        }

        // Bottom strip
        n = left + n_left * cellSize + cellSize * ii;
        m = bottom - n_bottom * cellSize + cellSize * jj;
        if (n < right && m < bottom) {
          velocity = velocity + calculateAdditionalVelocity(
            i,
            vec2<i32>(i32(n / cellSize), i32(m / cellSize)),
            pp,
          );
        }
      }
    }
  }

  // Centermass fallback: deepest level only. levelTextureSize at level
  // (levels-1) is 2^levels.
  if (levelsActive > 0u) {
    let deepest = levelsActive - 1u;
    let levelTextureSizeF = exp2(force.levels);
    var cmVelocity = calculateCentermassVelocity(deepest, levelTextureSizeF, pp);
    // Random jitter (matches force-centermass.wgsl: velocity += velocity*random)
    let rnd = textureLoad(randomValues, coords, 0);
    cmVelocity = cmVelocity + cmVelocity * rnd.rg;
    velocity = velocity + cmVelocity;
  }

  textureStore(velocityOut, coords, vec4<f32>(velocity.x, velocity.y, 0.0, 0.0));
}
`
}
