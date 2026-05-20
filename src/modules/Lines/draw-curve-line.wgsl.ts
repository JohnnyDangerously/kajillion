import {
  composeLineDrawShaderWgsl,
  conicCurveWgsl,
} from '@/graph/modules/Lines/shaders/line-draw-source.wgsl'
import {
  curveLineVertexMainWgsl,
} from '@/graph/modules/Lines/shaders/draw-curve-line-main.wgsl'
import { curveLineIntroWgsl } from '@/graph/modules/Lines/shaders/draw-curve-line-intro.wgsl'

export function drawCurveLineWgslSource (): string {
  return composeLineDrawShaderWgsl({
    intro: curveLineIntroWgsl,
    beforeUniforms: conicCurveWgsl,
    vertexMain: curveLineVertexMainWgsl,
  })
}
