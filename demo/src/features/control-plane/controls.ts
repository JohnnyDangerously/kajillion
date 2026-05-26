import { parsePaletteParam } from '../../gallery-presets'
import type { ControlElements } from './dom'
import { applyDepthPresetToControls, syncTuningLabels } from './depth-presets'
import type { DemoConfig, PointBorderTreatment } from './types'
export { isWorkMode } from '../work-mode'

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

function readBorderTreatment (value: string | null): PointBorderTreatment {
  return value === 'off' || value === 'darker' || value === 'shadow' || value === 'both'
    ? value
    : 'black'
}

export function writeRange (input: HTMLInputElement, value: number): void {
  input.value = String(value)
}

function ensureNodeCountOption (select: HTMLSelectElement, value: string): void {
  if ([...select.options].some(o => o.value === value)) return
  select.add(new Option(Number.parseInt(value, 10).toLocaleString(), value))
}

// Some representations bring their own positions and require a specific
// node count to render correctly. Until the preset interface gains an
// `ownsData` mechanism, defaulting `n` here is the smallest fix that lets
// `?rep=<id>` URLs Just Work without the user having to also pass `&n=...`.
const REP_NODE_COUNT_DEFAULT: Record<string, string> = {
  // 5,157 bin nodes + up to ~13,000 starfield stars: ~2,000 halo dots
  // at the disc's exact 100×100 cadence (rings 0–2 indistinguishable
  // from disc rings, then fading out across rings 3–11) + a wide
  // 1/r ambient field with bright giants. The exact star count is
  // determined by ring geometry in starfield.ts; this constant just
  // needs to be ≥ that total.
  'neon-network': '19500',
}

export function hydrateControlsFromUrl (ctlEl: ControlElements): void {
  const params = new URLSearchParams(window.location.search)
  const explicitN = params.get('n')
  const rep = params.get('rep')
  const n = explicitN ?? (rep ? REP_NODE_COUNT_DEFAULT[rep] ?? null : null)
  if (n && Number.isFinite(Number.parseInt(n, 10))) {
    ensureNodeCountOption(ctlEl.n, n)
    ctlEl.n.value = n
  }
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
  ctlEl.borderTreatment.value = readBorderTreatment(params.get('border') ?? params.get('pointBorderTreatment'))
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
    pointBorderTreatment: readBorderTreatment(ctlEl.borderTreatment.value),
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
