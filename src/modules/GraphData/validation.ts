import { isNumber } from '@/graph/helper'

export const MIN_POINT_SHAPE = 0
export const MAX_POINT_SHAPE = 8

export function isValidNumber (value: number | undefined): value is number {
  return isNumber(value)
}

export function isValidPointShape (shape: number | undefined): shape is number {
  return shape != null && isNumber(shape) && shape >= MIN_POINT_SHAPE && shape <= MAX_POINT_SHAPE
}
