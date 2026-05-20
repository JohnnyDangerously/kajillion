import type { RgbColor } from './types'

export function clamp01 (value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function mixRgb (
  a: RgbColor,
  b: RgbColor,
  t: number
): RgbColor {
  const u = clamp01(t)
  return [
    a[0] + (b[0] - a[0]) * u,
    a[1] + (b[1] - a[1]) * u,
    a[2] + (b[2] - a[2]) * u,
  ]
}
