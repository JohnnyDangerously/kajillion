import type { ControlElements } from './dom'
import type { DepthPreset } from './types'

const DEPTH_PRESETS: Record<Exclude<DepthPreset, 'custom'>, {
  strength: number;
  size: number;
  brightness: number;
  opacity: number;
  moat: number;
  highlight: number;
  shadow: number;
  saturation: number;
}> = {
  off: { strength: 0, size: 0, brightness: 0, opacity: 0, moat: 0, highlight: 0, shadow: 0, saturation: 0 },
  subtle: { strength: 0.18, size: 0.045, brightness: 0.08, opacity: 0.08, moat: 0.10, highlight: 0.12, shadow: 0.10, saturation: 0.08 },
  standard: { strength: 0.34, size: 0.075, brightness: 0.13, opacity: 0.12, moat: 0.20, highlight: 0.18, shadow: 0.18, saturation: 0.12 },
  vivid: { strength: 0.55, size: 0.12, brightness: 0.22, opacity: 0.18, moat: 0.30, highlight: 0.28, shadow: 0.26, saturation: 0.20 },
}

export function applyDepthPresetToControls (ctlEl: ControlElements, preset: DepthPreset): void {
  if (preset === 'custom') return
  const values = DEPTH_PRESETS[preset]
  writeRange(ctlEl.depthStrength, values.strength)
  writeRange(ctlEl.depthSize, values.size)
  writeRange(ctlEl.depthBrightness, values.brightness)
  writeRange(ctlEl.depthOpacity, values.opacity)
  writeRange(ctlEl.depthMoat, values.moat)
  writeRange(ctlEl.depthHighlight, values.highlight)
  writeRange(ctlEl.depthShadow, values.shadow)
  writeRange(ctlEl.depthSaturation, values.saturation)
}

export function syncTuningLabels (ctlEl: ControlElements): void {
  ctlEl.depthStrengthValue.textContent = readRange(ctlEl.depthStrength, 0).toFixed(2)
  ctlEl.depthSizeValue.textContent = readRange(ctlEl.depthSize, 0).toFixed(3)
  ctlEl.depthBrightnessValue.textContent = readRange(ctlEl.depthBrightness, 0).toFixed(2)
  ctlEl.depthOpacityValue.textContent = readRange(ctlEl.depthOpacity, 0).toFixed(2)
  ctlEl.depthMoatValue.textContent = readRange(ctlEl.depthMoat, 0).toFixed(2)
  ctlEl.depthHighlightValue.textContent = readRange(ctlEl.depthHighlight, 0).toFixed(2)
  ctlEl.depthShadowValue.textContent = readRange(ctlEl.depthShadow, 0).toFixed(2)
  ctlEl.depthSaturationValue.textContent = readRange(ctlEl.depthSaturation, 0).toFixed(2)
  ctlEl.tileBudgetValue.textContent = `${Math.round(readRange(ctlEl.tileBudget, 0))}/tile`
  ctlEl.tileSizeValue.textContent = `${Math.round(readRange(ctlEl.tileSize, 20))}px`
  ctlEl.tileMaxScaleValue.textContent = readRange(ctlEl.tileMaxScale, 0).toFixed(2)
}

function writeRange (input: HTMLInputElement, value: number): void {
  input.value = String(value)
}

function readRange (input: HTMLInputElement, fallback: number): number {
  const parsed = Number.parseFloat(input.value)
  if (!Number.isFinite(parsed)) return fallback
  const min = Number.parseFloat(input.min)
  const max = Number.parseFloat(input.max)
  return Math.max(min, Math.min(max, parsed))
}
