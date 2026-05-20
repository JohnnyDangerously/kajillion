import { parsePaletteParam } from '../../gallery-presets'
import type { ControlElements } from './dom'
import type { DemoConfig, DepthPreset } from './types'
export { isWorkMode } from '../work-mode'

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

export function boolParam (value: string | null, fallback: boolean): boolean {
  if (value === null || value === '') return fallback
  return value === '1' || value === 'true'
}

export function numberParam (value: string | null, fallback: number, min = -Infinity, max = Infinity): number {
  if (value === null || value === '') return fallback
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

export function readRange (input: HTMLInputElement, fallback: number): number {
  return numberParam(input.value, fallback, Number.parseFloat(input.min), Number.parseFloat(input.max))
}

function writeRange (input: HTMLInputElement, value: number): void {
  input.value = String(value)
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

export function hydrateControlsFromUrl (ctlEl: ControlElements): void {
  const params = new URLSearchParams(window.location.search)
  const n = params.get('n')
  if (n && [...ctlEl.n.options].some(o => o.value === n)) ctlEl.n.value = n
  const data = params.get('data')
  if (data === 'ba' || data === 'cosmo' || data === 'work') ctlEl.data.value = data
  if (data === 'work' && !n) ctlEl.n.value = '4000'
  const seed = params.get('seed')
  if (seed !== null && seed !== '') ctlEl.seed.value = seed
  ctlEl.webgpu.checked = boolParam(params.get('useWebGPU'), ctlEl.webgpu.checked)
  const msaa = params.get('msaa')
  if (msaa === '4') ctlEl.msaa.checked = true
  if (msaa === '1') ctlEl.msaa.checked = false
  ctlEl.adpr.checked = boolParam(params.get('adaptiveDpr'), ctlEl.adpr.checked)
  const blend = params.get('linkBlendMode') ?? params.get('blend')
  if (blend === 'normal' || blend === 'add') ctlEl.blend.value = blend
  const theme = params.get('theme')
  if (theme === 'light') {
    ctlEl.theme.classList.remove('active')
    ctlEl.theme.textContent = 'light'
  } else if (theme === 'dark') {
    ctlEl.theme.classList.add('active')
    ctlEl.theme.textContent = 'dark'
  }
  const fpsHeadroom = params.get('frameRateHeadroomFps') ?? params.get('fpsHeadroom')
  const frameCap = fpsHeadroom && fpsHeadroom !== '0'
    ? `headroom-${fpsHeadroom}`
    : params.get('frameRateLimit') ?? params.get('fpsCap')
  if (frameCap && [...ctlEl.frameCap.options].some(o => o.value === frameCap)) ctlEl.frameCap.value = frameCap
  ctlEl.edges.classList.toggle('active', boolParam(params.get('renderLinks'), ctlEl.edges.classList.contains('active')))
  ctlEl.density.classList.toggle('active', boolParam(params.get('density'), ctlEl.density.classList.contains('active')))
  ctlEl.lod.classList.toggle('active', boolParam(params.get('lod'), ctlEl.lod.classList.contains('active')))
  ctlEl.lanes.classList.toggle('active', boolParam(params.get('lanes'), ctlEl.lanes.classList.contains('active')))
  ctlEl.tilt.classList.toggle('active', boolParam(params.get('tilt'), ctlEl.tilt.classList.contains('active')))
  const depthPreset = params.get('depthPreset') ?? params.get('depth')
  if (depthPreset === 'off' || depthPreset === 'subtle' || depthPreset === 'standard' || depthPreset === 'vivid' || depthPreset === 'custom') {
    ctlEl.depthPreset.value = depthPreset
    applyDepthPresetToControls(ctlEl, depthPreset)
  }
  writeRange(ctlEl.depthStrength, numberParam(params.get('depthStrength') ?? params.get('pointDepthCueStrength'), readRange(ctlEl.depthStrength, 0), 0, 1))
  writeRange(ctlEl.depthSize, numberParam(params.get('depthSize') ?? params.get('pointDepthCueSize'), readRange(ctlEl.depthSize, 0), 0, 0.25))
  writeRange(ctlEl.depthBrightness, numberParam(params.get('depthBrightness') ?? params.get('pointDepthCueBrightness'), readRange(ctlEl.depthBrightness, 0), 0, 0.4))
  writeRange(ctlEl.depthOpacity, numberParam(params.get('depthOpacity') ?? params.get('pointDepthCueOpacity'), readRange(ctlEl.depthOpacity, 0), 0, 0.4))
  writeRange(ctlEl.depthMoat, numberParam(params.get('depthMoat') ?? params.get('pointDepthCueMoat'), readRange(ctlEl.depthMoat, 0), 0, 0.5))
  writeRange(ctlEl.depthHighlight, numberParam(params.get('depthHighlight') ?? params.get('pointDepthCueHighlight'), readRange(ctlEl.depthHighlight, 0), 0, 0.75))
  writeRange(ctlEl.depthShadow, numberParam(params.get('depthShadow') ?? params.get('pointDepthCueShadow'), readRange(ctlEl.depthShadow, 0), 0, 0.75))
  writeRange(ctlEl.depthSaturation, numberParam(params.get('depthSaturation') ?? params.get('pointDepthCueSaturation'), readRange(ctlEl.depthSaturation, 0), 0, 0.5))
  writeRange(ctlEl.tileBudget, numberParam(params.get('tileBudget') ?? params.get('pointTileBudget'), readRange(ctlEl.tileBudget, 0), 0, 16))
  writeRange(ctlEl.tileSize, numberParam(params.get('tileSize') ?? params.get('pointTileBudgetSize'), readRange(ctlEl.tileSize, 20), 8, 48))
  writeRange(ctlEl.tileMaxScale, numberParam(params.get('tileMaxScale') ?? params.get('pointTileBudgetMaxScale'), readRange(ctlEl.tileMaxScale, 0), 0, 2.5))
  ctlEl.sim.checked = boolParam(params.get('sim'), ctlEl.sim.checked)
  syncTuningLabels(ctlEl)
}

export function readControls (ctlEl: ControlElements): DemoConfig {
  const params = new URLSearchParams(window.location.search)
  const n = parseInt(ctlEl.n.value, 10)
  const theme = ctlEl.theme.classList.contains('active') ? 'dark' : 'light'
  return {
    n,
    dataMode: ctlEl.data.value === 'ba'
      ? 'ba'
      : ctlEl.data.value === 'work'
        ? 'work'
        : 'cosmo',
    seed: parseInt(ctlEl.seed.value, 10) || 42,
    webgpu: true,
    msaa: ctlEl.msaa.checked,
    adaptiveDpr: ctlEl.adpr.checked,
    theme,
    palette: parsePaletteParam(params.get('palette')),
    blend: ctlEl.blend.value === 'normal' ? 'normal' : 'add',
    sim: ctlEl.sim.checked,
    renderLinks: ctlEl.edges.classList.contains('active'),
    density: ctlEl.density.classList.contains('active'),
    lod: ctlEl.lod.classList.contains('active'),
    lanes: ctlEl.lanes.classList.contains('active'),
    tilt: ctlEl.tilt.classList.contains('active'),
    depthPreset: ctlEl.depthPreset.value === 'off' || ctlEl.depthPreset.value === 'subtle' || ctlEl.depthPreset.value === 'vivid' || ctlEl.depthPreset.value === 'custom'
      ? ctlEl.depthPreset.value
      : 'standard',
    pointDepthCueStrength: readRange(ctlEl.depthStrength, 0.34),
    pointDepthCueSize: readRange(ctlEl.depthSize, 0.075),
    pointDepthCueBrightness: readRange(ctlEl.depthBrightness, 0.13),
    pointDepthCueOpacity: readRange(ctlEl.depthOpacity, 0.12),
    pointDepthCueMoat: readRange(ctlEl.depthMoat, 0.20),
    pointDepthCueHighlight: readRange(ctlEl.depthHighlight, 0.18),
    pointDepthCueShadow: readRange(ctlEl.depthShadow, 0.18),
    pointDepthCueSaturation: readRange(ctlEl.depthSaturation, 0.12),
    pointTileBudget: Math.round(readRange(ctlEl.tileBudget, 5)),
    pointTileBudgetSize: Math.round(readRange(ctlEl.tileSize, 20)),
    pointTileBudgetMaxScale: readRange(ctlEl.tileMaxScale, 0.72),
    massConserve: boolParam(params.get('massConserve'), false),
    debugFrameTrace: boolParam(
      params.get('flashDebug') ??
        params.get('debugFrameTrace'),
      false
    ),
    frameRateLimit: ctlEl.frameCap.value.startsWith('headroom-') ? 0 : Number.parseFloat(ctlEl.frameCap.value) || 0,
    frameRateHeadroomFps: ctlEl.frameCap.value.startsWith('headroom-')
      ? Number.parseFloat(ctlEl.frameCap.value.slice('headroom-'.length)) || 0
      : 0,
  }
}
