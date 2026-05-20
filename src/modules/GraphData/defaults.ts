import { type GraphConfigInterface } from '@/graph/config'
import { defaultConfigValues } from '@/graph/variables'
import { isValidPointShape } from './validation'

export const NO_POINT_IMAGE_INDEX = -1

export function resolvePointDefaultShape (config: GraphConfigInterface): number {
  const { pointDefaultShape } = config
  const configShape = typeof pointDefaultShape === 'string' ? Number(pointDefaultShape) : pointDefaultShape
  return isValidPointShape(configShape) ? configShape : defaultConfigValues.pointDefaultShape
}
