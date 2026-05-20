export function mulberry32 (seed: number): () => number {
  let t = seed >>> 0
  return function () {
    t = (t + 0x6d_2b_79_f5) | 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4_294_967_296
  }
}

export function normal01 (rng: () => number): number {
  const u = Math.max(rng(), 1e-7)
  const v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
