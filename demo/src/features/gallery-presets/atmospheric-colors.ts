import type { RgbColor } from './types'
import { clamp01, mixRgb } from './color-utils'

export function emberParticleColor (
  normalizedX: number,
  normalizedY: number,
  hash: number,
  degree: number
): RgbColor {
  const top = clamp01((0.58 - normalizedY) / 0.48)
  const bottom = clamp01((normalizedY - 0.42) / 0.52)
  const equatorShadow = Math.exp(-Math.pow((normalizedY - 0.50) / 0.105, 2))
  const rim = clamp01(Math.abs(normalizedX - 0.5) * 2)
  const spark = clamp01((degree > 9 ? 0.20 : 0) + (hash > 0.86 ? (hash - 0.86) * 1.8 : 0))
  const warm: RgbColor = [1.0, 0.55 + spark * 0.18, 0.08]
  const hot: RgbColor = [1.0, 0.93, 0.70]
  const silver: RgbColor = [0.78, 0.84, 0.82]
  const white: RgbColor = [0.96, 0.98, 0.95]
  const coal: RgbColor = [0.09, 0.075, 0.055]
  const upper = mixRgb(warm, hot, clamp01(top * 0.58 + spark))
  const lower = mixRgb(silver, white, clamp01(bottom * 0.42 + rim * 0.18))
  const lit = top >= bottom ? upper : lower
  return mixRgb(lit, coal, clamp01(equatorShadow * (0.74 - rim * 0.30)))
}

export function emberLinkColor (
  sourceY: number,
  targetY: number,
  sourceColor: RgbColor,
  targetColor: RgbColor
): RgbColor {
  const midY = (sourceY + targetY) * 0.5
  const equatorShadow = Math.exp(-Math.pow((midY - 0.50) / 0.13, 2))
  const base = mixRgb(sourceColor, targetColor, 0.5)
  return mixRgb(base, [0.12, 0.10, 0.08], clamp01(0.54 + equatorShadow * 0.30))
}

export function ionParticleColor (
  normalizedX: number,
  normalizedY: number,
  hash: number,
  degree: number
): RgbColor {
  const angle = Math.atan2(normalizedY - 0.5, normalizedX - 0.5)
  const radial = Math.hypot(normalizedX - 0.5, normalizedY - 0.5)
  const band = (Math.sin(angle * 3.0 + radial * 10.0) + 1) * 0.5
  const cyan: RgbColor = [0.02, 0.94, 1.0]
  const magenta: RgbColor = [1.0, 0.12, 0.78]
  const violet: RgbColor = [0.46, 0.28, 1.0]
  const green: RgbColor = [0.34, 1.0, 0.54]
  const base = band < 0.34
    ? mixRgb(cyan, green, band / 0.34)
    : band < 0.68
      ? mixRgb(green, magenta, (band - 0.34) / 0.34)
      : mixRgb(magenta, violet, (band - 0.68) / 0.32)
  const hot = clamp01((degree > 8 ? 0.18 : 0) + (hash > 0.92 ? (hash - 0.92) * 4.0 : 0))
  return mixRgb(base, [0.92, 0.98, 1.0], hot)
}

export function ionLinkColor (
  sourceColor: RgbColor,
  targetColor: RgbColor
): RgbColor {
  return mixRgb(mixRgb(sourceColor, targetColor, 0.5), [0.06, 0.10, 0.18], 0.42)
}

export function signalParticleColor (
  normalizedX: number,
  normalizedY: number,
  hash: number,
  degree: number
): RgbColor {
  const cx = normalizedX - 0.5
  const cy = normalizedY - 0.5
  const radial = Math.hypot(cx, cy)
  const ring = Math.exp(-Math.pow((radial - 0.28) / 0.030, 2))
  const spoke = Math.exp(-Math.pow(Math.sin(Math.atan2(cy, cx) * 18), 2) / 0.12)
  const hub = Math.exp(-Math.pow(radial / 0.11, 2))
  const orangePulse = hash > 0.992 || (degree > 24 && hash > 0.965)
  if (orangePulse) return [1.0, 0.22 + ring * 0.18, 0.02]
  const luminance = clamp01(0.36 + ring * 0.54 + hub * 0.48 + spoke * 0.10 + (hash > 0.92 ? 0.18 : 0))
  return [luminance, luminance * 0.98, luminance * 0.92]
}

export function signalLinkColor (
  sourceColor: RgbColor,
  targetColor: RgbColor
): RgbColor {
  const base = mixRgb(sourceColor, targetColor, 0.5)
  const isOrange = base[0] > 0.85 && base[1] < 0.42
  return isOrange ? mixRgb(base, [1.0, 0.24, 0.04], 0.42) : mixRgb(base, [0.90, 0.90, 0.86], 0.62)
}

export function cosmicParticleColor (
  normalizedX: number,
  normalizedY: number,
  hash: number,
  degree: number
): RgbColor {
  const diagonal = clamp01((normalizedX * 0.72 + (1 - normalizedY) * 0.64) / 1.16)
  const voidBlue = Math.exp(-Math.pow((normalizedY - 0.72) / 0.19, 2))
  const hotGold = degree > 10 || hash > 0.982
  const starWhite = degree > 22 || hash > 0.996
  const amber: RgbColor = [1.0, 0.56, 0.13]
  const deepBlue: RgbColor = [0.10, 0.34, 0.88]
  const cyan: RgbColor = [0.04, 0.82, 0.92]
  const violet: RgbColor = [0.58, 0.22, 0.92]
  const ember = mixRgb(amber, [1.0, 0.86, 0.42], clamp01((degree - 4) / 28 + hash * 0.15))
  const cold = mixRgb(deepBlue, cyan, clamp01(voidBlue * 0.65 + hash * 0.18))
  const base = diagonal > 0.48 ? mixRgb(violet, ember, clamp01((diagonal - 0.30) / 0.70)) : mixRgb(cold, violet, clamp01(diagonal * 1.35))
  if (starWhite) return mixRgb(base, [1.0, 0.96, 0.82], 0.86)
  if (hotGold) return mixRgb(base, [1.0, 0.72, 0.22], 0.58)
  return base
}

export function cosmicLinkColor (
  sourceY: number,
  targetY: number,
  sourceColor: RgbColor,
  targetColor: RgbColor
): RgbColor {
  const base = mixRgb(sourceColor, targetColor, 0.5)
  const upperWeb = clamp01((0.58 - ((sourceY + targetY) * 0.5)) / 0.45)
  const gold: RgbColor = [1.0, 0.62, 0.18]
  const plasma: RgbColor = [0.70, 0.42, 1.0]
  const teal: RgbColor = [0.02, 0.68, 0.80]
  return mixRgb(mixRgb(teal, plasma, upperWeb), mixRgb(base, gold, 0.55), 0.64)
}

export function tokyoParticleColor (
  normalizedX: number,
  normalizedY: number,
  hash: number,
  degree: number
): RgbColor {
  const cx = normalizedX - 0.5
  const cy = normalizedY - 0.5
  const radial = Math.hypot(cx, cy)
  const angle = Math.atan2(cy, cx)
  const redSector = normalizedX > 0.51 && normalizedY > 0.51 && angle > 0.08 && angle < 1.45
  if (redSector && (radial > 0.30 || degree > 8 || hash > 0.62)) {
    const heat = clamp01(0.82 + radial * 0.42 + (degree > 10 ? 0.12 : 0))
    return [heat, 0.13 + hash * 0.06, 0.08]
  }
  const rim = Math.exp(-Math.pow((radial - 0.49) / 0.045, 2))
  const star = degree > 12 || hash > 0.985
  const luminance = clamp01((star ? 1.0 : 0.72) + rim * 0.26 + (hash > 0.93 ? 0.11 : 0))
  return [luminance, luminance, luminance * 0.97]
}

export function tokyoLinkColor (
  sourceColor: RgbColor,
  targetColor: RgbColor
): RgbColor {
  const base = mixRgb(sourceColor, targetColor, 0.5)
  const isRed = base[0] > 0.72 && base[1] < 0.36 && base[2] < 0.26
  return isRed ? mixRgb(base, [1.0, 0.18, 0.10], 0.34) : mixRgb(base, [0.82, 0.82, 0.80], 0.52)
}

export function insightParticleColor (
  normalizedX: number,
  normalizedY: number,
  hash: number,
  degree: number
): RgbColor {
  const yellow = normalizedX < 0.48 && normalizedY < 0.48
  const magenta = normalizedX > 0.46 && normalizedY > 0.47
  if (yellow) {
    const lift = clamp01(0.72 + degree * 0.018 + hash * 0.10)
    return [1.0, lift * 0.72, 0.02]
  }
  if (magenta) {
    const lift = clamp01(0.68 + degree * 0.017 + hash * 0.12)
    return [1.0, 0.30 + lift * 0.22, 0.86]
  }
  const v = clamp01(0.18 + degree * 0.010 + hash * 0.08)
  return [v, v, v]
}

export function insightLinkColor (
  sourceColor: RgbColor,
  targetColor: RgbColor
): RgbColor {
  const base = mixRgb(sourceColor, targetColor, 0.5)
  const highlighted = base[0] > 0.70 && (base[1] > 0.30 || base[2] > 0.46)
  return highlighted ? base : mixRgb(base, [0.26, 0.26, 0.26], 0.76)
}
