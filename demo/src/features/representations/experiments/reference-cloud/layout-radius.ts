import { atlasHash } from '../atlas-reference/metrics'

export function atlasRadius (i: number, seed: number): number {
  const q = atlasHash(i * 61, seed)
  const noise = atlasHash(i * 73, seed)
  if (q > 0.9985) return 7.8 + noise * 3.1
  if (q > 0.987) return 4.9 + noise * 1.85
  if (q > 0.936) return 3.25 + noise * 1.10
  if (q > 0.760) return 2.05 + noise * 0.62
  if (q > 0.340) return 1.24 + noise * 0.34
  return 0.74 + noise * 0.22
}

export function unitRadius (screenRadius: number): number {
  const ring = screenRadius < 1.5
    ? Math.min(0.44, screenRadius * 0.36)
    : screenRadius < 3
      ? 0.62 + screenRadius * 0.09
      : screenRadius < 7
        ? 0.92 + screenRadius * 0.09
        : Math.min(2.35, 1.28 + screenRadius * 0.09)
  return (screenRadius + ring + 0.08) * 1.05 / 270
}
