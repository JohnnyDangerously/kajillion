export function forceManyBodyLevelBindings (maxLevels: number): string {
  return Array.from({ length: maxLevels }, (_, i) =>
    `@group(0) @binding(${4 + i}) var levelFbo${i}: texture_2d<f32>;`
  ).join('\n')
}

export function forceManyBodySampleLevelCases (maxLevels: number): string {
  return Array.from({ length: maxLevels }, (_, i) =>
    `    case ${i}u: { return textureLoad(levelFbo${i}, ij, 0); }`
  ).join('\n')
}

export const FORCE_MANY_BODY_VELOCITY_HELPERS_WGSL = `// Per-cell contribution from Barnes-Hut node (matches force-level.wgsl).
fn calculateAdditionalVelocity(level: u32, ij: vec2<i32>, pp: vec2<f32>) -> vec2<f32> {
  var add = vec2<f32>(0.0);
  let centermass = sampleLevelTexture(level, ij);
  if (centermass.r > 0.0 && centermass.g > 0.0 && centermass.b > 0.0) {
    let centermassPosition = centermass.rg / centermass.b;
    let distVector = pp - centermassPosition;
    var l = dot(distVector, distVector);
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

// Centermass fallback for the deepest level (matches force-centermass.wgsl).
fn calculateCentermassVelocity(level: u32, levelTextureSizeF: f32, pp: vec2<f32>) -> vec2<f32> {
  var add = vec2<f32>(0.0);
  let ij = vec2<i32>(
    i32(pp.x / force.spaceSize * levelTextureSizeF),
    i32(pp.y / force.spaceSize * levelTextureSizeF),
  );
  let centermass = sampleLevelTexture(level, ij);
  if (centermass.r > 0.0 && centermass.g > 0.0 && centermass.b > 0.0) {
    let centermassPosition = centermass.rg / centermass.b;
    let distVector = pp - centermassPosition;
    var l = dot(distVector, distVector);
    if (l > 0.0) {
      let c = force.alpha * force.repulsion * centermass.b;
      let distanceMin2: f32 = 1.0;
      if (l < distanceMin2) {
        l = sqrt(distanceMin2 * l);
      }
      let addV = c / sqrt(l);
      // normalize(distVector) replaces the legacy atan2+cos/sin reconstruction;
      // identical output (unit vector along distVector), 6 ALU ops saved.
      add = addV * normalize(distVector);
    }
  }
  return add;
}`
