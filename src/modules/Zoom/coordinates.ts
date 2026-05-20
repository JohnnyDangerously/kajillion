import { NativeZoomTransform } from './native'

export function convertScreenToSpacePosition (
  screenPosition: [number, number],
  transform: NativeZoomTransform,
  screenSize: readonly [number, number],
  adjustedSpaceSize: number
): [number, number] {
  const [w, h] = screenSize
  const invertedX = (screenPosition[0] - transform.x) / transform.k
  const invertedY = (screenPosition[1] - transform.y) / transform.k
  const spacePosition = [invertedX, h - invertedY] as [number, number]
  spacePosition[0] -= (w - adjustedSpaceSize) / 2
  spacePosition[1] -= (h - adjustedSpaceSize) / 2
  return spacePosition
}

export function convertSpaceToScreenPosition (
  spacePosition: [number, number],
  transform: NativeZoomTransform,
  scaleX: (value: number) => number,
  scaleY: (value: number) => number
): [number, number] {
  return [
    transform.applyX(scaleX(spacePosition[0])),
    transform.applyY(scaleY(spacePosition[1])),
  ]
}

export function convertSpaceToScreenRadius (
  spaceRadius: number,
  scalePointsOnZoom: boolean,
  maxPointSize: number,
  zoomLevel: number
): number {
  let size = spaceRadius * 2
  if (scalePointsOnZoom) {
    size *= zoomLevel
  }
  return Math.min(size, maxPointSize) / 2
}
