export function hash01 (index: number): number {
  return (Math.imul(index + 1, 2654435761) >>> 0) / 0x1_0000_0000
}

export function mixedHash01 (index: number, salt: number): number {
  let x = Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca77)
  x ^= x >>> 16
  x = Math.imul(x, 0x7feb352d)
  x ^= x >>> 15
  x = Math.imul(x, 0x846ca68b)
  x ^= x >>> 16
  return (x >>> 0) / 0x1_0000_0000
}
