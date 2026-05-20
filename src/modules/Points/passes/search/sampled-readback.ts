export function readSampledPointPositionsMap (pixels: Float32Array): Map<number, [number, number]> {
  const positions = new Map<number, [number, number]>()
  for (let i = 0; i < pixels.length / 4; i += 1) {
    const index = pixels[i * 4]
    const isNotEmpty = !!pixels[i * 4 + 1]
    const x = pixels[i * 4 + 2]
    const y = pixels[i * 4 + 3]
    if (isNotEmpty && index !== undefined && x !== undefined && y !== undefined) {
      positions.set(index, [x, y])
    }
  }
  return positions
}

export function readSampledPoints (pixels: Float32Array): { indices: number[]; positions: number[] } {
  const indices: number[] = []
  const positions: number[] = []
  for (let i = 0; i < pixels.length / 4; i += 1) {
    const index = pixels[i * 4]
    const isNotEmpty = !!pixels[i * 4 + 1]
    const x = pixels[i * 4 + 2]
    const y = pixels[i * 4 + 3]
    if (isNotEmpty && index !== undefined && x !== undefined && y !== undefined) {
      indices.push(index)
      positions.push(x, y)
    }
  }
  return { indices, positions }
}
