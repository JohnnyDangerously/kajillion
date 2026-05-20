import { normal01 } from './random'
import type { CommunityOrigin, CommunityRange } from './types'

export const COSMO_SPACE_SIZE = 4096
const HALF_SPACE = COSMO_SPACE_SIZE / 2

export function createCommunityOrigins (communityCount: number, baseRadius: number): CommunityOrigin[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  const origins: CommunityOrigin[] = []
  for (let c = 0; c < communityCount; c += 1) {
    const ring = baseRadius + Math.floor(c / 12) * baseRadius * 0.6
    const angle = c * goldenAngle
    origins.push({ cx: Math.cos(angle) * ring, cy: Math.sin(angle) * ring })
  }
  return origins
}

export function fillCommunityPositions (
  positions: Float32Array,
  communitySizes: number[],
  origins: CommunityOrigin[],
  baseRadius: number,
  layoutStyle: 'cosmo' | 'organic',
  rng: () => number,
): CommunityRange[] {
  const ranges: CommunityRange[] = []
  let pointIndex = 0
  for (let c = 0; c < communitySizes.length; c += 1) {
    const size = communitySizes[c] ?? 0
    const origin = origins[c] ?? { cx: 0, cy: 0 }
    ranges.push({ start: pointIndex, end: pointIndex + size })
    pointIndex = fillOneCommunity(positions, pointIndex, size, origin, baseRadius, layoutStyle, rng, c)
  }
  return ranges
}

function fillOneCommunity (
  positions: Float32Array,
  pointIndex: number,
  size: number,
  origin: CommunityOrigin,
  baseRadius: number,
  layoutStyle: 'cosmo' | 'organic',
  rng: () => number,
  communityIndex: number,
): number {
  const jitter = baseRadius * 0.18
  const major = jitter * (0.55 + rng() * 0.72)
  const minor = jitter * (0.18 + rng() * 0.30)
  const axis = communityIndex * Math.PI * (3 - Math.sqrt(5)) + (rng() - 0.5) * 1.4
  const tail = jitter * (0.25 + rng() * 0.55)
  for (let i = 0; i < size; i += 1) {
    const [x, y] = layoutStyle === 'organic'
      ? organicOffset(i, size, major, minor, tail, axis, communityIndex, rng)
      : [(rng() - 0.5) * 2 * jitter, (rng() - 0.5) * 2 * jitter]
    positions[pointIndex * 2] = HALF_SPACE + origin.cx + x
    positions[pointIndex * 2 + 1] = HALF_SPACE + origin.cy + y
    pointIndex += 1
  }
  return pointIndex
}

function organicOffset (
  i: number,
  size: number,
  major: number,
  minor: number,
  tail: number,
  axis: number,
  communityIndex: number,
  rng: () => number,
): [number, number] {
  const ordinal = size > 1 ? i / (size - 1) : 0
  const arm = (rng() < 0.20 ? 1 : 0) * (ordinal - 0.5) * tail
  const gx = normal01(rng) * major + arm
  const gy = normal01(rng) * minor + Math.sin(ordinal * Math.PI * 2 + communityIndex) * minor * 0.22
  const swirl = 0.20 * Math.sin(ordinal * Math.PI * 4 + communityIndex * 0.7)
  const ca = Math.cos(axis + swirl)
  const sa = Math.sin(axis + swirl)
  return [gx * ca - gy * sa, gx * sa + gy * ca]
}

export function clampPositionsToWorld (positions: Float32Array, count: number): void {
  const marginScale = 0.86
  let maxOffset = 0
  for (let i = 0; i < count; i += 1) {
    maxOffset = Math.max(maxOffset, Math.abs((positions[i * 2] ?? HALF_SPACE) - HALF_SPACE))
    maxOffset = Math.max(maxOffset, Math.abs((positions[i * 2 + 1] ?? HALF_SPACE) - HALF_SPACE))
  }
  const maxAllowedOffset = HALF_SPACE * marginScale
  if (maxOffset <= maxAllowedOffset) return
  const scale = maxAllowedOffset / maxOffset
  for (let i = 0; i < count; i += 1) {
    positions[i * 2] = HALF_SPACE + ((positions[i * 2] ?? HALF_SPACE) - HALF_SPACE) * scale
    positions[i * 2 + 1] = HALF_SPACE + ((positions[i * 2 + 1] ?? HALF_SPACE) - HALF_SPACE) * scale
  }
}
