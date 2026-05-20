import type { GalleryPalette, RgbColor } from './types'
import { analystLinkColor, analystParticleColor, subnetLinkColor, subnetParticleColor } from './work-colors'
import {
  cosmicLinkColor,
  cosmicParticleColor,
  emberLinkColor,
  emberParticleColor,
  insightLinkColor,
  insightParticleColor,
  ionLinkColor,
  ionParticleColor,
  signalLinkColor,
  signalParticleColor,
  tokyoLinkColor,
  tokyoParticleColor,
} from './atmospheric-colors'
import { displayPaletteColor, paletteColor } from './display-colors'
import { mixRgb } from './color-utils'

export { displayPaletteColor }

export function galleryParticleColor (
  palette: GalleryPalette,
  normalizedX: number,
  normalizedY: number,
  hash: number,
  degree: number
): RgbColor {
  if (palette === 'ember') return emberParticleColor(normalizedX, normalizedY, hash, degree)
  if (palette === 'ion') return ionParticleColor(normalizedX, normalizedY, hash, degree)
  if (palette === 'signal') return signalParticleColor(normalizedX, normalizedY, hash, degree)
  if (palette === 'cosmic') return cosmicParticleColor(normalizedX, normalizedY, hash, degree)
  if (palette === 'tokyo') return tokyoParticleColor(normalizedX, normalizedY, hash, degree)
  if (palette === 'subnet') return subnetParticleColor(normalizedX, normalizedY, hash, degree)
  if (palette === 'analyst') return analystParticleColor(normalizedX, normalizedY, hash, degree)
  if (palette === 'insight') return insightParticleColor(normalizedX, normalizedY, hash, degree)
  return paletteColor(Math.floor(hash * 8))
}

export function galleryLinkColor (
  palette: GalleryPalette,
  sourceY: number,
  targetY: number,
  sourceColor: RgbColor,
  targetColor: RgbColor
): RgbColor {
  if (palette === 'ember') return emberLinkColor(sourceY, targetY, sourceColor, targetColor)
  if (palette === 'ion') return ionLinkColor(sourceColor, targetColor)
  if (palette === 'signal') return signalLinkColor(sourceColor, targetColor)
  if (palette === 'cosmic') return cosmicLinkColor(sourceY, targetY, sourceColor, targetColor)
  if (palette === 'tokyo') return tokyoLinkColor(sourceColor, targetColor)
  if (palette === 'subnet') return subnetLinkColor(sourceColor, targetColor)
  if (palette === 'analyst') return analystLinkColor(sourceColor, targetColor)
  if (palette === 'insight') return insightLinkColor(sourceColor, targetColor)
  return mixRgb(sourceColor, targetColor, 0.5)
}
