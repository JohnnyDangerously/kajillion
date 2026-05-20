export function flattenPointPositions (pointPositions: [number, number][]): number[] {
  return pointPositions.flat()
}

export function pairPointPositions (pointPositions: number[]): [number, number][] {
  const arr = new Array(pointPositions.length / 2) as [number, number][]
  for (let i = 0; i < pointPositions.length / 2; i++) {
    arr[i] = [pointPositions[i * 2] as number, pointPositions[i * 2 + 1] as number]
  }
  return arr
}
