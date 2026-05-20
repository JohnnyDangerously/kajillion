import type { RgbColor } from './types'

const DISPLAY_PALETTE: RgbColor[] = [
  [0.11, 0.70, 1.00],
  [0.02, 0.78, 0.58],
  [0.62, 0.92, 0.07],
  [1.00, 0.62, 0.00],
  [0.98, 0.18, 0.67],
  [0.45, 0.38, 1.00],
  [1.00, 0.32, 0.18],
  [0.95, 0.10, 0.34],
]

const LIGHT_DISPLAY_PALETTE: RgbColor[] = [
  [0.00, 0.48, 1.00],
  [0.00, 0.70, 0.52],
  [0.46, 0.78, 0.00],
  [1.00, 0.50, 0.00],
  [1.00, 0.08, 0.54],
  [0.50, 0.30, 1.00],
  [1.00, 0.24, 0.10],
  [0.94, 0.00, 0.28],
]

export function displayPaletteColor (idx: number, isLight: boolean): RgbColor {
  return isLight ? lightPaletteColor(idx) : paletteColor(idx)
}

export function paletteColor (idx: number): RgbColor {
  return DISPLAY_PALETTE[idx % DISPLAY_PALETTE.length] ?? [0.5, 0.7, 1]
}

function lightPaletteColor (idx: number): RgbColor {
  return LIGHT_DISPLAY_PALETTE[idx % LIGHT_DISPLAY_PALETTE.length] ?? [0.0, 0.48, 1.0]
}
