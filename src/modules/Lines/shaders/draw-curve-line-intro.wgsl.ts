export const curveLineIntroWgsl = `// WGSL counterpart to draw-curve-line.vert + draw-curve-line.frag.
// One file, both entry points, used when useWebGPU = true.
//
// Triangle-strip geometry (per-link instance) sweeping a curved Bezier
// ribbon between two point indices. The vertex shader samples both endpoint
// positions, builds a rational quadratic Bezier control point for the
// curved case, calculates the link width (with hover/focus widening and
// optional zoom-aware scaling), applies link visibility/greyout fading,
// and emits a varying per-segment used to draw either the link body or an
// arrow head in the fragment shader. The fragment shader doubles as a
// link picker when renderMode > 0 (writes the link index instead of colour).

// Rational quadratic Bezier (conic parametric curve), inlined from
// conic-curve-module.ts since WGSL has no shadertools-style module include.`
