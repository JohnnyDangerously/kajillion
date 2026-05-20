import {
  drawLineUniformsStructWgsl,
  precomputeLineUniformsStructWgsl,
} from './shaders/line-uniforms.wgsl'
import {
  lineInstanceStorageBindingsWgsl,
  lineInstanceStructWgsl,
} from './shaders/line-instance-layout.wgsl'
import { precomputeLineHelpersWgsl } from './shaders/precompute-line-helpers.wgsl'
import { precomputeLineMainWgsl } from './shaders/precompute-line-main.wgsl'

export {
  drawLineUniformsStructWgsl,
  precomputeLineUniformsStructWgsl,
} from './shaders/line-uniforms.wgsl'
export {
  lineInstanceStorageBindingsWgsl,
  lineInstanceStructWgsl,
} from './shaders/line-instance-layout.wgsl'

// WebGPU per-instance pre-pass for line rendering.
//
// The fragment-rasterization vertex shader (draw-curve-line.wgsl) does
// ~16 instance-uniform computations 4x per quad. This compute pass does
// them once per link and writes the packed LineInstance storage buffer.
export function precomputeLineInstancesWgsl (): string {
  return `
${drawLineUniformsStructWgsl}
${precomputeLineUniformsStructWgsl}
${lineInstanceStructWgsl}
${lineInstanceStorageBindingsWgsl}
${precomputeLineHelpersWgsl}
${precomputeLineMainWgsl}
`
}
