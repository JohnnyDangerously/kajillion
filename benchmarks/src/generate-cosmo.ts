// Port of the cosmo-lab community-structured graph generator, stripped
// to just the topology + initial positions kajillion's engine consumes.
// Source of truth: tokyo-graph-tools/ui-simple/src/features/cosmo-lab/
// generate.ts (function `generateCosmoLabGraph`). When that file changes
// in cosmo-lab, mirror the changes here so bench data stays comparable.
//
// Outputs the same shape generateBA produces: a Float32Array of
// interleaved (x,y) positions and a Float32Array of interleaved
// (source, target) link indices.

import { type GeneratedGraph } from './generate-graph'

function mulberry32 (seed: number): () => number {
  let t = seed >>> 0
  return function () {
    t = (t + 0x6d_2b_79_f5) | 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4_294_967_296
  }
}

function skewedPartition (total: number, parts: number, rng: () => number): number[] {
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

function pickCommunityWeighted (sizes: number[], total: number, rng: () => number): number {
  const r = rng() * total
  let acc = 0
  for (const [i, size] of sizes.entries()) {
    acc += size ?? 0
    if (r < acc) return i
  }
  return sizes.length - 1
}

export interface CosmoLabOptions {
  count: number;
  /** Number of communities. Same default as cosmo-lab:
   *  max(8, min(20, round(log2(count) - 3))). */
  communityCount?: number;
  /** Average intra-community edges per node. */
  intraDensity?: number;
  /** Fraction of total nodes that get one cross-community bridge edge. */
  bridgeFraction?: number;
  /** Seed for reproducible generation. */
  seed?: number;
}

export function generateCosmoLab (opts: CosmoLabOptions): GeneratedGraph {
  const count = Math.max(1, Math.floor(opts.count))
  const defaultCommunityCount = Math.max(8, Math.min(20, Math.round(Math.log2(count) - 3)))
  const communityCount = Math.max(2, Math.floor(opts.communityCount ?? defaultCommunityCount))
  const intraDensity = opts.intraDensity ?? 1.2
  const bridgeFraction = opts.bridgeFraction ?? 0.02
  const rng = mulberry32(opts.seed ?? 0xc05_03)

  const communitySizes = skewedPartition(count, communityCount, rng)

  // Pre-place each community on a ring around origin.
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  const baseRadius = Math.max(800, Math.sqrt(count) * 6)
  const communityOrigins: { cx: number; cy: number }[] = []
  for (let c = 0; c < communityCount; c += 1) {
    const ring = baseRadius + Math.floor(c / 12) * baseRadius * 0.6
    const angle = c * goldenAngle
    communityOrigins.push({ cx: Math.cos(angle) * ring, cy: Math.sin(angle) * ring })
  }

  // Engine's spaceSize defaults to 4096. cosmo-lab generates positions in
  // a small range around origin (-baseRadius..+baseRadius) and lets the
  // engine's randomSeed+spaceSize do the actual placement when no
  // pointXBy/pointYBy is bound. For our bench we want deterministic
  // positions, so center them inside spaceSize.
  const HALF_SPACE = 4096 / 2
  const positions = new Float32Array(count * 2)
  let pointIndex = 0
  const communityRanges: { start: number; end: number }[] = []
  for (let c = 0; c < communityCount; c += 1) {
    const size = communitySizes[c] ?? 0
    const origin = communityOrigins[c] ?? { cx: 0, cy: 0 }
    const jitter = baseRadius * 0.18
    communityRanges.push({ start: pointIndex, end: pointIndex + size })
    for (let i = 0; i < size; i += 1) {
      positions[pointIndex * 2] = HALF_SPACE + origin.cx + (rng() - 0.5) * 2 * jitter
      positions[pointIndex * 2 + 1] = HALF_SPACE + origin.cy + (rng() - 0.5) * 2 * jitter
      pointIndex += 1
    }
  }

  // Keep the seeded layout inside the simulation world. The force update clamps
  // positions to [0, spaceSize]; if initial communities spill outside the world,
  // the first sim frames flatten them against the boundaries and the demo reads
  // as a square. Preserve the relative community layout, just shrink it enough
  // to leave visible breathing room.
  const marginScale = 0.86
  let maxOffset = 0
  for (let i = 0; i < count; i += 1) {
    maxOffset = Math.max(
      maxOffset,
      Math.abs((positions[i * 2] ?? HALF_SPACE) - HALF_SPACE),
      Math.abs((positions[i * 2 + 1] ?? HALF_SPACE) - HALF_SPACE)
    )
  }
  const maxAllowedOffset = HALF_SPACE * marginScale
  if (maxOffset > maxAllowedOffset) {
    const scale = maxAllowedOffset / maxOffset
    for (let i = 0; i < count; i += 1) {
      positions[i * 2] = HALF_SPACE + ((positions[i * 2] ?? HALF_SPACE) - HALF_SPACE) * scale
      positions[i * 2 + 1] = HALF_SPACE + ((positions[i * 2 + 1] ?? HALF_SPACE) - HALF_SPACE) * scale
    }
  }

  const linkBuf: number[] = []
  const seen = new Set<bigint>()
  const intraEdgeBudget = Math.floor(count * intraDensity)
  for (let attempts = 0, written = 0; written < intraEdgeBudget && attempts < intraEdgeBudget * 4; attempts += 1) {
    const c = pickCommunityWeighted(communitySizes, count, rng)
    const range = communityRanges[c]
    if (!range) continue
    const a = range.start + Math.floor(rng() * (range.end - range.start))
    const b = range.start + Math.floor(rng() * (range.end - range.start))
    if (a === b) continue
    const lo = a < b ? a : b
    const hi = a < b ? b : a
    const key = (BigInt(lo) << 32n) | BigInt(hi)
    if (seen.has(key)) continue
    seen.add(key)
    linkBuf.push(lo, hi)
    written += 1
  }

  // Community lookup for bridge filtering — given a point index, which community?
  const communityOf = new Int32Array(count)
  for (const [c, range] of communityRanges.entries()) {
    if (!range) continue
    for (let i = range.start; i < range.end; i += 1) communityOf[i] = c
  }

  const bridgeBudget = Math.floor(count * bridgeFraction)
  for (let i = 0, written = 0; written < bridgeBudget && i < bridgeBudget * 4; i += 1) {
    const a = Math.floor(rng() * count)
    const b = Math.floor(rng() * count)
    if (a === b) continue
    if (communityOf[a] === communityOf[b]) continue
    const lo = a < b ? a : b
    const hi = a < b ? b : a
    const key = (BigInt(lo) << 32n) | BigInt(hi)
    if (seen.has(key)) continue
    seen.add(key)
    linkBuf.push(lo, hi)
    written += 1
  }

  return {
    positions,
    links: new Float32Array(linkBuf),
    nodeCount: count,
    edgeCount: linkBuf.length / 2,
  }
}
