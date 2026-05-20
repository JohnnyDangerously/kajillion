// Memory: 112 B per instance x 300k = ~34 MB at the bench dataset.
//
// Layout must mirror the WGSL struct in draw-curve-line.wgsl exactly,
// including padding for vec2/vec4 alignment.
export const lineInstanceStructWgsl = `
struct LineInstance {
  // World-space positions resolved from points texture, snapped to vec4
  // alignment (.zw unused; left as 0 for future expansion).
  a: vec4<f32>,
  b: vec4<f32>,
  // Curve control point + curvedWeight packed in .zw (.z = w, .w unused).
  controlPoint: vec4<f32>,
  // .xy = curved-perp at t=0.5 (used for the straight-line case; the
  // curved case recomputes per-vertex anyway). .zw = full color, post-
  // opacity, post-greyout, post-hover-override.
  yBasisPad: vec4<f32>,
  rgbaColor: vec4<f32>,
  // Scalars packed into vec4 slots to keep std430 alignment simple.
  // .x = linkWidthPx (post hover/focus increment + post smoothing pad)
  // .y = smoothing (smoothingPx / linkWidthPx ratio passed to fragment)
  // .z = arrowLength (per-curve fraction)
  // .w = useArrow flag (0.0 or 1.0)
  widthSmoothingArrow: vec4<f32>,
  // .x = arrowWidthFactor (fragment uses it for the body/arrow blend)
  // .y = linkIndex (kept here for the picking path; same value as the
  //      legacy per-instance attribute)
  // .z = culled flag (1.0 = vertex shader emits degenerate offscreen
  //      position; 0.0 = draw normally)
  // .w = reserved
  arrowFactorIndexCulled: vec4<f32>,
};
`

// Bindings mirror the existing per-instance vertex buffers 1:1 -- those
// buffers already exist for the WebGL2 path + the WebGPU picking pass, so
// adding Buffer.STORAGE usage to them is a one-flag change vs. creating
// duplicate packed copies on the CPU side. Six separate read-only storage
// arrays for the instance attributes, one read-only positions array, one
// read_write storage buffer for the packed output. 8 storage bindings
// total -- at the spec minimum for maxStorageBuffersPerShaderStage; M5 Max
// reports 32, so plenty of headroom in practice.
export const lineInstanceStorageBindingsWgsl = `
@group(0) @binding(0) var<uniform> drawLine: DrawLineUniforms;
@group(0) @binding(1) var<uniform> precomputeLine: PrecomputeLineUniforms;
@group(0) @binding(2) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> pointAArr: array<vec2<f32>>;
@group(0) @binding(4) var<storage, read> pointBArr: array<vec2<f32>>;
@group(0) @binding(5) var<storage, read> colorArr: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read> widthArr: array<f32>;
@group(0) @binding(7) var<storage, read> arrowArr: array<f32>;
@group(0) @binding(8) var<storage, read> linkIndexArr: array<f32>;
@group(0) @binding(9) var<storage, read_write> instances: array<LineInstance>;
`
