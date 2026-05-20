import type { RgbColor } from './types'
import { clamp01, mixRgb } from './color-utils'

const SUBNET_SECTOR_PALETTE: RgbColor[] = [
  [0.50, 0.16, 1.00],
  [0.83, 0.18, 0.92],
  [1.00, 0.16, 0.14],
  [1.00, 0.55, 0.00],
  [1.00, 0.92, 0.00],
  [0.26, 0.82, 0.14],
  [0.28, 0.60, 1.00],
]

export function subnetParticleColor (
  normalizedX: number,
  normalizedY: number,
  hash: number,
  degree: number
): RgbColor {
  const angle = Math.atan2(normalizedY - 0.5, normalizedX - 0.5)
  const sector = (Math.floor(((angle + Math.PI) / (Math.PI * 2)) * 7) + 7) % 7
  const base = SUBNET_SECTOR_PALETTE[sector] ?? SUBNET_SECTOR_PALETTE[0]!
  const hubLift = clamp01((degree - 4) / 18)
  const jitter = (hash - 0.5) * 0.06
  return [
    clamp01(base[0] + hubLift * 0.08 + jitter),
    clamp01(base[1] + hubLift * 0.08 + jitter),
    clamp01(base[2] + hubLift * 0.08 + jitter),
  ]
}

export function subnetLinkColor (
  sourceColor: RgbColor,
  targetColor: RgbColor
): RgbColor {
  return mixRgb(mixRgb(sourceColor, targetColor, 0.48), [1.0, 1.0, 1.0], 0.10)
}

export function analystParticleColor (
  normalizedX: number,
  normalizedY: number,
  hash: number,
  degree: number
): RgbColor {
  const focus = normalizedX > 0.42 && normalizedX < 0.72 && normalizedY > 0.34 && normalizedY < 0.70
  const central = Math.max(0, 1 - Math.hypot(normalizedX - 0.56, normalizedY - 0.52) * 3.4)
  const rank = clamp01(degree / 18 + central * 0.35)
  if (focus || rank > 0.62) {
    return mixRgb([0.12, 0.50, 0.86], [0.76, 0.90, 1.0], clamp01(rank * 0.72 + hash * 0.16))
  }
  const v = clamp01(0.90 + hash * 0.08 + rank * 0.06)
  return [v, v, v]
}

export function analystLinkColor (
  sourceColor: RgbColor,
  targetColor: RgbColor
): RgbColor {
  const mixed = mixRgb(sourceColor, targetColor, 0.50)
  const blueSignal = mixed[2] - Math.max(mixed[0], mixed[1])
  if (blueSignal > 0.08) return mixRgb(mixed, [0.18, 0.48, 0.82], 0.54)
  return [0.10, 0.11, 0.12]
}
