export type InitialPositionRescaleResult = {
  scaleX: ((x: number) => number) | undefined;
  scaleY: ((y: number) => number) | undefined;
}

export function rescaleInitialPointPositions (
  points: Float32Array | number[],
  spaceSize: number
): InitialPositionRescaleResult {
  const pointsNumber = points.length / 2
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i] as number
    const y = points[i + 1] as number
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  const w = maxX - minX
  const h = maxY - minY
  const range = Math.max(w, h)

  if (range > spaceSize) {
    return { scaleX: undefined, scaleY: undefined }
  }

  const densityThreshold = spaceSize * spaceSize * 0.001
  const effectiveSpaceSize = pointsNumber > densityThreshold
    ? spaceSize * Math.max(1.2, Math.sqrt(pointsNumber) / spaceSize)
    : spaceSize * 0.1

  const scaleFactor = effectiveSpaceSize / range
  const centerOffset = (spaceSize - effectiveSpaceSize) / 2
  const offsetX = ((range - w) / 2) * scaleFactor + centerOffset
  const offsetY = ((range - h) / 2) * scaleFactor + centerOffset

  const scaleX = (x: number): number => (x - minX) * scaleFactor + offsetX
  const scaleY = (y: number): number => (y - minY) * scaleFactor + offsetY

  for (let i = 0; i < pointsNumber; i++) {
    points[i * 2] = scaleX(points[i * 2] as number)
    points[i * 2 + 1] = scaleY(points[i * 2 + 1] as number)
  }

  return { scaleX, scaleY }
}
