export interface CellShape {
  ringOffsets: Uint32Array;
  ringAlphas: Uint8Array;
  edgeOffsets: Uint32Array;
  edgeBlend: Float32Array;
}

export function buildCellShape (size: number): CellShape {
  const r = size * 0.5
  const ringOuter = r
  const ringInner = r - (size * 0.07)
  const photoOuter = ringInner - 1.5
  const edgeSoft = 1.6
  const ringOff: number[] = []
  const ringA: number[] = []
  const edgeOff: number[] = []
  const edgeT: number[] = []
  for (let y = 0; y < size; y += 1) {
    const dy = y + 0.5 - r
    const dy2 = dy * dy
    const dstRow = y * size * 4
    for (let x = 0; x < size; x += 1) {
      const dx = x + 0.5 - r
      const dist = Math.sqrt((dx * dx) + dy2)
      const di = dstRow + (x * 4)
      if (dist >= ringOuter) continue
      if (dist >= ringInner) {
        const a = dist <= ringOuter - edgeSoft ? 1 : (ringOuter - dist) / edgeSoft
        ringOff.push(di)
        ringA.push((a * 255) | 0)
        continue
      }
      if (dist >= photoOuter) {
        edgeOff.push(di)
        edgeT.push((dist - photoOuter) / (ringInner - photoOuter))
      }
    }
  }
  return {
    ringOffsets: new Uint32Array(ringOff),
    ringAlphas: new Uint8Array(ringA),
    edgeOffsets: new Uint32Array(edgeOff),
    edgeBlend: new Float32Array(edgeT),
  }
}

export function bakeBase (
  out: ImageData,
  full: ImageData,
  sx: number,
  sy: number,
  size: number
): void {
  const r = size * 0.5
  const photoOuter = r - (size * 0.07) - 1.5
  const src = full.data
  const dst = out.data
  const stride = full.width * 4
  for (let y = 0; y < size; y += 1) {
    const dy = y + 0.5 - r
    const dy2 = dy * dy
    const srcRow = (sy + (size - 1 - y)) * stride + (sx * 4)
    const dstRow = y * size * 4
    for (let x = 0; x < size; x += 1) {
      const dx = x + 0.5 - r
      const dist = Math.sqrt((dx * dx) + dy2)
      if (dist >= photoOuter) continue
      const si = srcRow + (x * 4)
      const di = dstRow + (x * 4)
      dst[di] = src[si] as number
      dst[di + 1] = src[si + 1] as number
      dst[di + 2] = src[si + 2] as number
      dst[di + 3] = 255
    }
  }
}

export function captureEdgeSourceColors (
  full: ImageData,
  shape: CellShape,
  sx: number,
  sy: number,
  size: number
): Uint8Array {
  const edgeN = shape.edgeOffsets.length
  const srcCol = new Uint8Array(edgeN * 3)
  const stride = full.width * 4
  for (let k = 0; k < edgeN; k += 1) {
    const di = shape.edgeOffsets[k] as number
    const px = (di >> 2) % size
    const py = Math.floor((di >> 2) / size)
    const si = ((sy + (size - 1 - py)) * stride) + ((sx + px) * 4)
    srcCol[k * 3] = full.data[si] as number
    srcCol[(k * 3) + 1] = full.data[si + 1] as number
    srcCol[(k * 3) + 2] = full.data[si + 2] as number
  }
  return srcCol
}
