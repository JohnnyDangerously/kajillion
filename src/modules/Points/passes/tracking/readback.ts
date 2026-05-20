export function createTrackedPositionsMap (
  pixels: Float32Array,
  trackedIndices: readonly number[],
): Map<number, [number, number]> {
  const tracked = new Map<number, [number, number]>()
  for (let i = 0; i < pixels.length / 4; i += 1) {
    const x = pixels[i * 4]
    const y = pixels[i * 4 + 1]
    const index = trackedIndices[i]
    if (x !== undefined && y !== undefined && index !== undefined) {
      tracked.set(index, [x, y])
    }
  }
  return tracked
}

export function createTrackedPositionsArray (
  pixels: Float32Array,
  trackedIndices: readonly number[],
): number[] {
  const positions: number[] = []
  positions.length = trackedIndices.length * 2
  for (let i = 0; i < pixels.length / 4; i += 1) {
    const x = pixels[i * 4]
    const y = pixels[i * 4 + 1]
    const index = trackedIndices[i]
    if (x !== undefined && y !== undefined && index !== undefined) {
      positions[i * 2] = x
      positions[i * 2 + 1] = y
    }
  }
  return positions
}
