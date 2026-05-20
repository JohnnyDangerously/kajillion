import { drawPointsCommonWgsl } from './draw-points/common.wgsl'
import { drawPointsVertexWgsl } from './draw-points/vertex.wgsl'
import { drawPointsFragmentShapesWgsl } from './draw-points/fragment-shapes.wgsl'
import { drawPointsFragmentMainWgsl } from './draw-points/fragment-main.wgsl'

export const drawPointsWgsl = [
  drawPointsCommonWgsl,
  drawPointsVertexWgsl,
  drawPointsFragmentShapesWgsl,
  drawPointsFragmentMainWgsl,
].join('\n\n') + '\n'
