export function skewedPartition (total: number, parts: number, rng: () => number): number[] {
  const raw: number[] = new Array(parts)
  let sum = 0
  for (let i = 0; i < parts; i += 1) {
    const w = Math.pow(rng(), 1.6) * (parts - i)
    raw[i] = w + 1
    sum += raw[i] ?? 0
  }

  const out: number[] = new Array(parts)
  let assigned = 0
  for (let i = 0; i < parts - 1; i += 1) {
    const sz = Math.max(1, Math.floor(((raw[i] ?? 0) / sum) * total))
    out[i] = sz
    assigned += sz
  }
  out[parts - 1] = Math.max(1, total - assigned)
  return out
}

export function pickCommunityWeighted (sizes: number[], total: number, rng: () => number): number {
  const r = rng() * total
  let acc = 0
  for (const [i, size] of sizes.entries()) {
    acc += size ?? 0
    if (r < acc) return i
  }
  return sizes.length - 1
}
