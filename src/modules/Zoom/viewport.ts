import { clamp } from '@/graph/helper'
import { NativeZoomTransform } from './native'
import { constrainAxis } from './scale'

export type TranslateExtent = [[number, number], [number, number]]

export function getUnboundedTranslateExtent (): TranslateExtent {
  return [
    [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
    [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
  ]
}

export function getGraphTranslateExtent (
  screenSize: readonly [number, number],
  spaceSize: number,
  cameraBoundsPadding: number
): TranslateExtent | undefined {
  const [width, height] = screenSize
  if (!width || !height || !Number.isFinite(spaceSize) || spaceSize <= 0) return undefined

  const padding = spaceSize * Math.max(0, cameraBoundsPadding)
  const minX = (width - spaceSize) / 2 - padding
  const maxX = (width + spaceSize) / 2 + padding
  const minY = (height - spaceSize) / 2 - padding
  const maxY = (height + spaceSize) / 2 + padding
  return [[minX, minY], [maxX, maxY]]
}

export function constrainTransformToViewport (
  transform: NativeZoomTransform,
  screenSize: readonly [number, number],
  translateExtent: TranslateExtent,
  minZoom: number,
  maxZoom: number
): NativeZoomTransform {
  const [width, height] = screenSize
  if (!width || !height) return transform

  const k = clamp(transform.k, minZoom, maxZoom)
  let x = transform.x
  let y = transform.y
  const [[minX, minY], [maxX, maxY]] = translateExtent

  if (Number.isFinite(minX) && Number.isFinite(maxX)) {
    x = constrainAxis(x, k, minX, maxX, width)
  }
  if (Number.isFinite(minY) && Number.isFinite(maxY)) {
    y = constrainAxis(y, k, minY, maxY, height)
  }
  return new NativeZoomTransform(x, y, k)
}

export function getTransformForPositions (
  positions: number[] | Float32Array,
  screenSize: readonly [number, number],
  scaleX: (value: number) => number,
  scaleY: (value: number) => number,
  minZoom: number,
  maxZoom: number,
  scale?: number,
  padding = 0.1
): NativeZoomTransform | undefined {
  if (positions.length === 0) return undefined
  const [width, height] = screenSize

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < positions.length; i += 2) {
    const x = positions[i] as number
    const y = positions[i + 1] as number
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }

  const xExtent: [number, number] = [scaleX(minX), scaleX(maxX)]
  const yExtent: [number, number] = [scaleY(minY), scaleY(maxY)]
  if (xExtent[0] === xExtent[1]) {
    xExtent[0] -= 0.5
    xExtent[1] += 0.5
  }
  if (yExtent[0] === yExtent[1]) {
    yExtent[0] += 0.5
    yExtent[1] -= 0.5
  }

  const xScale = (width * (1 - padding * 2)) / (xExtent[1] - xExtent[0])
  const yScale = (height * (1 - padding * 2)) / (yExtent[0] === yExtent[1] ? 1 : yExtent[0] - yExtent[1])
  const clampedScale = clamp(scale ?? Math.min(xScale, yScale), minZoom, maxZoom)
  const xCenter = (xExtent[1] + xExtent[0]) / 2
  const yCenter = (yExtent[1] + yExtent[0]) / 2

  return new NativeZoomTransform(
    width / 2 - xCenter * clampedScale,
    height / 2 - yCenter * clampedScale,
    clampedScale
  )
}

export function getMiddlePointTransform (
  position: [number, number],
  screenSize: readonly [number, number],
  current: NativeZoomTransform,
  scaleX: (value: number) => number,
  scaleY: (value: number) => number
): NativeZoomTransform {
  const [width, height] = screenSize
  const currX = (width / 2 - current.x) / current.k
  const currY = (height / 2 - current.y) / current.k
  const pointX = scaleX(position[0])
  const pointY = scaleY(position[1])
  const centerX = (currX + pointX) / 2
  const centerY = (currY + pointY) / 2

  return new NativeZoomTransform(
    width / 2 - centerX,
    height / 2 - centerY,
    1
  )
}
