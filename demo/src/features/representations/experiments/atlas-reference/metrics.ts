export const ATLAS_GROUP_COUNT = 13

export const ATLAS_COLORS: ReadonlyArray<readonly [number, number, number]> = [
  [0.00, 0.72, 1.00],
  [0.00, 0.86, 0.72],
  [0.94, 0.08, 0.04],
  [1.00, 0.78, 0.05],
  [0.06, 0.94, 0.48],
  [0.95, 0.04, 0.45],
  [0.66, 0.36, 1.00],
  [1.00, 0.50, 0.02],
  [0.05, 0.58, 1.00],
  [0.70, 0.92, 0.08],
  [0.02, 0.92, 0.95],
  [0.55, 0.82, 1.00],
  [0.82, 0.18, 0.95],
]

const SIZE_TIERS = [
  28, 31, 34, 38, 42,
  47, 53, 60, 69, 80,
  94, 112, 135, 162, 196,
]

export function atlasHash (value: number, seed: number): number {
  let x = (Math.imul(value + 1, 374761393) ^ Math.imul(seed + 101, 668265263)) >>> 0
  x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0
  return ((x ^ (x >>> 16)) >>> 0) / 0x1_0000_0000
}

export function atlasGroupForNode (node: number, nodeCount: number, seed: number): number {
  if (node <= 0) return 0
  const sequential = Math.floor(((node - 1) / Math.max(1, nodeCount - 1)) * ATLAS_GROUP_COUNT)
  const drift = atlasHash(node * 17, seed) > 0.86 ? Math.floor(atlasHash(node * 19, seed) * 3) - 1 : 0
  return Math.max(0, Math.min(ATLAS_GROUP_COUNT - 1, sequential + drift))
}

export function atlasTierForNode (node: number, seed: number): number {
  if (node <= 0) return -1
  const importance = 1 - atlasHash(node * 29, seed)
  for (let i = TIER_THRESHOLDS.length - 1; i >= 0; i -= 1) {
    if (importance >= TIER_THRESHOLDS[i]!) return i
  }
  return 0
}

export function atlasSizeForNode (node: number, seed: number): number {
  const tier = atlasTierForNode(node, seed)
  if (tier < 0) return 0
  return SIZE_TIERS[tier] ?? SIZE_TIERS[0]!
}

const TIER_THRESHOLDS = [
  0.00, 0.18, 0.32, 0.44, 0.54,
  0.63, 0.71, 0.78, 0.84, 0.89,
  0.925, 0.95, 0.97, 0.985, 0.995,
]
