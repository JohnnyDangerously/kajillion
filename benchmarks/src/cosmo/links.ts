import { pickCommunityWeighted } from './partition'
import type { CommunityRange } from './types'

export function generateCommunityLinks (
  count: number,
  communitySizes: number[],
  communityRanges: CommunityRange[],
  intraDensity: number,
  bridgeFraction: number,
  rng: () => number,
): number[] {
  const links: number[] = []
  const seen = new Set<bigint>()
  writeIntraCommunityLinks(links, seen, count, communitySizes, communityRanges, intraDensity, rng)
  writeBridgeLinks(links, seen, count, communityRanges, bridgeFraction, rng)
  return links
}

function writeIntraCommunityLinks (
  links: number[],
  seen: Set<bigint>,
  count: number,
  communitySizes: number[],
  ranges: CommunityRange[],
  intraDensity: number,
  rng: () => number,
): void {
  const budget = Math.floor(count * intraDensity)
  for (let attempts = 0, written = 0; written < budget && attempts < budget * 4; attempts += 1) {
    const c = pickCommunityWeighted(communitySizes, count, rng)
    const range = ranges[c]
    if (!range) continue
    const a = range.start + Math.floor(rng() * (range.end - range.start))
    const b = range.start + Math.floor(rng() * (range.end - range.start))
    if (writeUniqueLink(links, seen, a, b)) written += 1
  }
}

function writeBridgeLinks (
  links: number[],
  seen: Set<bigint>,
  count: number,
  communityRanges: CommunityRange[],
  bridgeFraction: number,
  rng: () => number,
): void {
  const communityOf = buildCommunityLookup(count, communityRanges)
  const budget = Math.floor(count * bridgeFraction)
  for (let i = 0, written = 0; written < budget && i < budget * 4; i += 1) {
    const a = Math.floor(rng() * count)
    const b = Math.floor(rng() * count)
    if (communityOf[a] === communityOf[b]) continue
    if (writeUniqueLink(links, seen, a, b)) written += 1
  }
}

function buildCommunityLookup (count: number, communityRanges: CommunityRange[]): Int32Array {
  const communityOf = new Int32Array(count)
  for (const [c, range] of communityRanges.entries()) {
    for (let i = range.start; i < range.end; i += 1) communityOf[i] = c
  }
  return communityOf
}

function writeUniqueLink (links: number[], seen: Set<bigint>, a: number, b: number): boolean {
  if (a === b) return false
  const lo = a < b ? a : b
  const hi = a < b ? b : a
  const key = (BigInt(lo) << 32n) | BigInt(hi)
  if (seen.has(key)) return false
  seen.add(key)
  links.push(lo, hi)
  return true
}
