import { drawCulledPointsFragmentWgsl } from './shaders/draw-culled-points/fragment'
import { drawCulledPointsSharedWgsl } from './shaders/draw-culled-points/shared'
import { drawCulledPointsVertexWgsl } from './shaders/draw-culled-points/vertex'

export const drawCulledPointsWgsl = [
  drawCulledPointsSharedWgsl,
  drawCulledPointsVertexWgsl,
  drawCulledPointsFragmentWgsl,
].join('\n')
