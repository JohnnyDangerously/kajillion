import { atlasHash } from '../atlas-reference/metrics'

const CLOUD_COLORS: ReadonlyArray<readonly [number, number, number]> = [
  [0.00, 0.72, 1.00], [0.00, 0.86, 0.70], [0.95, 0.05, 0.02],
  [1.00, 0.68, 0.00], [0.06, 0.94, 0.48], [0.95, 0.04, 0.45],
  [0.64, 0.37, 1.00], [0.98, 0.88, 0.05], [0.02, 0.93, 0.95],
  [0.90, 0.95, 1.00], [0.60, 0.90, 0.10], [1.00, 0.24, 0.12],
]

export function cloudColor (group: number, id: number, seed: number): readonly [number, number, number] {
  const base = CLOUD_COLORS[group % CLOUD_COLORS.length]!
  const v = 0.88 + atlasHash(id * 31, seed) * 0.32
  return [clamp(base[0] * v), clamp(base[1] * v), clamp(base[2] * v)]
}

export function rgb255 (color: readonly [number, number, number], boost = 1): string {
  return `${byte(color[0], boost)},${byte(color[1], boost)},${byte(color[2], boost)}`
}

function byte (v: number, boost: number): number {
  return Math.max(0, Math.min(255, Math.round(v * boost * 255)))
}

function clamp (v: number): number {
  return Math.max(0, Math.min(1, v))
}
