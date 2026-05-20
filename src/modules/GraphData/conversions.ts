import { getRgbaColor } from '@/graph/helper'
import { NO_POINT_IMAGE_INDEX } from './defaults'
import { isValidNumber, isValidPointShape } from './validation'

type RgbaColorInput = Parameters<typeof getRgbaColor>[0]

export function createRgbaValues (
  inputValues: Float32Array | undefined,
  itemCount: number,
  defaultColor: RgbaColorInput
): Float32Array {
  const defaultRgba = getRgbaColor(defaultColor)

  if (inputValues === undefined || inputValues.length / 4 !== itemCount) {
    const values = new Float32Array(itemCount * 4)
    for (let i = 0; i < values.length / 4; i++) {
      values[i * 4] = defaultRgba[0]
      values[i * 4 + 1] = defaultRgba[1]
      values[i * 4 + 2] = defaultRgba[2]
      values[i * 4 + 3] = defaultRgba[3]
    }
    return values
  }

  for (let i = 0; i < inputValues.length / 4; i++) {
    if (!isValidNumber(inputValues[i * 4])) inputValues[i * 4] = defaultRgba[0]
    if (!isValidNumber(inputValues[i * 4 + 1])) inputValues[i * 4 + 1] = defaultRgba[1]
    if (!isValidNumber(inputValues[i * 4 + 2])) inputValues[i * 4 + 2] = defaultRgba[2]
    if (!isValidNumber(inputValues[i * 4 + 3])) inputValues[i * 4 + 3] = defaultRgba[3]
  }
  return inputValues
}

export function createNumericValues (
  inputValues: Float32Array | undefined,
  itemCount: number,
  defaultValue: number
): Float32Array {
  if (inputValues === undefined || inputValues.length !== itemCount) {
    return new Float32Array(itemCount).fill(defaultValue)
  }

  for (let i = 0; i < inputValues.length; i++) {
    if (!isValidNumber(inputValues[i])) {
      inputValues[i] = defaultValue
    }
  }
  return inputValues
}

export function createPointShapes (
  inputShapes: Float32Array | undefined,
  itemCount: number,
  defaultShape: number
): Float32Array {
  if (inputShapes === undefined || inputShapes.length !== itemCount) {
    return new Float32Array(itemCount).fill(defaultShape)
  }

  const pointShapes = new Float32Array(inputShapes)
  for (let i = 0; i < pointShapes.length; i++) {
    if (!isValidPointShape(pointShapes[i])) {
      pointShapes[i] = defaultShape
    }
  }
  return pointShapes
}

export function createPointImageIndices (
  inputIndices: Float32Array | undefined,
  itemCount: number
): Float32Array {
  if (inputIndices === undefined || inputIndices.length !== itemCount) {
    return new Float32Array(itemCount).fill(NO_POINT_IMAGE_INDEX)
  }

  const pointImageIndices = new Float32Array(inputIndices)
  for (let i = 0; i < pointImageIndices.length; i++) {
    const rawIndex = pointImageIndices[i]
    const imageIndex = (rawIndex === undefined) ? NaN : rawIndex
    if (!Number.isFinite(imageIndex) || imageIndex < 0) {
      pointImageIndices[i] = NO_POINT_IMAGE_INDEX
    } else {
      pointImageIndices[i] = Math.trunc(imageIndex)
    }
  }
  return pointImageIndices
}

export function createPointImageSizes (
  inputSizes: Float32Array | undefined,
  itemCount: number,
  pointSizes: Float32Array | undefined,
  defaultSize: number
): Float32Array {
  if (inputSizes === undefined || inputSizes.length !== itemCount) {
    return pointSizes ? new Float32Array(pointSizes) : new Float32Array(itemCount).fill(defaultSize)
  }

  const pointImageSizes = new Float32Array(inputSizes)
  for (let i = 0; i < pointImageSizes.length; i++) {
    if (!isValidNumber(pointImageSizes[i])) {
      pointImageSizes[i] = pointSizes?.[i] ?? defaultSize
    }
  }
  return pointImageSizes
}

export function createLinkArrows (
  linkArrowsBoolean: boolean[] | undefined,
  linksNumber: number,
  defaultArrows: boolean
): number[] {
  if (linkArrowsBoolean === undefined || linkArrowsBoolean.length !== linksNumber) {
    return new Array(linksNumber).fill(+defaultArrows)
  }
  return linkArrowsBoolean.map(d => +d)
}
