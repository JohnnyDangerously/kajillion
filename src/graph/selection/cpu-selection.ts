export type ScreenPoint = [number, number]
export type ScreenRect = [[number, number], [number, number]]

type ConvertSpaceToScreenPosition = (position: ScreenPoint) => ScreenPoint

interface CpuPointSelectionOptions {
  positions: ArrayLike<number> | undefined
  pointsNumber: number
  convertSpaceToScreenPosition: ConvertSpaceToScreenPosition
}

interface CpuRectSelectionOptions extends CpuPointSelectionOptions {
  rect: ScreenRect
}

interface CpuPolygonSelectionOptions extends CpuPointSelectionOptions {
  polygonPath: ScreenPoint[]
}

export function findPointsInRectOnCpu ({
  positions,
  pointsNumber,
  rect,
  convertSpaceToScreenPosition,
}: CpuRectSelectionOptions): number[] {
  if (!positions || pointsNumber === 0) return []
  const minX = Math.min(rect[0][0], rect[1][0])
  const maxX = Math.max(rect[0][0], rect[1][0])
  const minY = Math.min(rect[0][1], rect[1][1])
  const maxY = Math.max(rect[0][1], rect[1][1])
  const result: number[] = []
  for (let i = 0; i < pointsNumber; i += 1) {
    const x = positions[i * 2]
    const y = positions[i * 2 + 1]
    if (x === undefined || y === undefined) continue
    const [screenX, screenY] = convertSpaceToScreenPosition([x, y])
    if (screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY) {
      result.push(i)
    }
  }
  return result
}

export function findPointsInPolygonOnCpu ({
  positions,
  pointsNumber,
  polygonPath,
  convertSpaceToScreenPosition,
}: CpuPolygonSelectionOptions): number[] {
  if (!positions || pointsNumber === 0) return []
  const result: number[] = []
  for (let i = 0; i < pointsNumber; i += 1) {
    const x = positions[i * 2]
    const y = positions[i * 2 + 1]
    if (x === undefined || y === undefined) continue
    const screenPosition = convertSpaceToScreenPosition([x, y])
    if (isScreenPointInPolygon(screenPosition, polygonPath)) {
      result.push(i)
    }
  }
  return result
}

export function isScreenPointInPolygon (point: ScreenPoint, polygon: ScreenPoint[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i]?.[0] ?? 0
    const yi = polygon[i]?.[1] ?? 0
    const xj = polygon[j]?.[0] ?? 0
    const yj = polygon[j]?.[1] ?? 0
    const intersects = ((yi > point[1]) !== (yj > point[1])) &&
      point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || Number.EPSILON) + xi
    if (intersects) inside = !inside
  }
  return inside
}
