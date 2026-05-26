import type { LoadedNetwork } from './network-types'

const TWO_PI = Math.PI * 2
const STRAGGLER_FRACTION = 0.07
const STRAGGLER_R_MIN_FACTOR = 1.15
const STRAGGLER_R_MAX_FACTOR = 1.55

export interface StragglerSplit {
  hop1Members: number[];
  hop2Members: number[];
  stragglers: number[];
}

export function computeStragglerCount (groupLength: number): number {
  return Math.min(
    Math.max(2, Math.round(groupLength * STRAGGLER_FRACTION)),
    Math.max(2, Math.round(groupLength * 0.12)),
  )
}

export function pickStragglers (
  group: number[],
  network: LoadedNetwork,
  hop1: number[],
  hop2: number[],
  count: number,
  seed: number,
): StragglerSplit {
  if (count <= 0 || group.length <= count + 2) {
    return { hop1Members: hop1, hop2Members: hop2, stragglers: [] }
  }
  const rand = makeRand(seed)
  const sortable = group.filter(idx => network.hops[idx] !== 0)
  sortable.sort((a, b) => (network.scores[a] ?? 0) - (network.scores[b] ?? 0))
  const candidatePool = sortable.slice(0, Math.max(count * 3, count + 1))
  const stragglerSet = new Set<number>()
  while (stragglerSet.size < count && stragglerSet.size < candidatePool.length) {
    stragglerSet.add(candidatePool[Math.floor(rand() * candidatePool.length)] as number)
  }
  return {
    hop1Members: hop1.filter(i => !stragglerSet.has(i)),
    hop2Members: hop2.filter(i => !stragglerSet.has(i)),
    stragglers: [...stragglerSet],
  }
}

export function placeStragglers (
  out: Float32Array,
  stragglers: number[],
  ccx: number,
  ccy: number,
  blobR: number,
  seed: number,
): void {
  if (stragglers.length === 0) return
  const rand = makeRand(seed ^ 0x9E3779B9)
  for (const idx of stragglers) {
    const theta = rand() * TWO_PI
    const width = STRAGGLER_R_MAX_FACTOR - STRAGGLER_R_MIN_FACTOR
    const r = blobR * (STRAGGLER_R_MIN_FACTOR + (rand() * width))
    out[idx * 2] = ccx + Math.cos(theta) * r
    out[(idx * 2) + 1] = ccy + Math.sin(theta) * r
  }
}

function makeRand (seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = ((s + 0x9E3779B9) | 0) >>> 0
    let z = s
    z = ((z ^ (z >>> 16)) * 0x85EBCA6B) >>> 0
    z = ((z ^ (z >>> 13)) * 0xC2B2AE35) >>> 0
    return ((z ^ (z >>> 16)) >>> 0) / 0x100000000
  }
}
