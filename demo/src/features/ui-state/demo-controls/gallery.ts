import {
  hydrateControlsFromUrl,
  readControls,
} from '../../control-plane/controls'
import type { ControlElements } from '../../control-plane/dom'
import type { DemoConfig } from '../../control-plane/types'
import {
  galleryPresetUrlDefaults,
  parsePaletteParam,
} from '../../../gallery-presets'
import { reportDemoControlError } from './errors'
import type { DemoControlActions } from './types'

const REBUILD_PALETTES = new Set<DemoConfig['palette']>([
  'tokyo',
  'subnet',
  'signal',
  'cosmic',
  'insight',
  'fintech',
  'influence',
  'talent',
])

export function syncGalleryButtons (
  ctlEl: ControlElements,
  currentConfig: DemoConfig
): void {
  for (const card of ctlEl.presetCards) {
    const preset = parsePaletteParam(card.dataset.preset ?? null)
    const isActive = preset === currentConfig.palette
    card.classList.toggle('active', isActive)
    card.setAttribute('aria-pressed', String(isActive))
  }
}

export function setGalleryOpen (ctlEl: ControlElements, open: boolean): void {
  ctlEl.gallery.classList.toggle('open', open)
  ctlEl.galleryTab.setAttribute('aria-expanded', String(open))
}

export function applyGalleryPreset (
  ctlEl: ControlElements,
  actions: DemoControlActions,
  preset: DemoConfig['palette'],
  syncToggleButtons: () => void
): void {
  const previousPalette = actions.getCurrentConfig().palette
  if (preset === 'cosmic') actions.resetCosmicIntroDismissal()
  const params = new URLSearchParams(window.location.search)
  if (preset === 'category') params.delete('palette')
  else params.set('palette', preset)
  for (const [key, value] of Object.entries(galleryPresetUrlDefaults(preset))) {
    if (value === null) params.delete(key)
    else params.set(key, value)
  }
  const query = params.toString()
  window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
  hydrateControlsFromUrl(ctlEl)
  const nextConfig = readControls(ctlEl)
  actions.setCurrentConfig(nextConfig)
  syncToggleButtons()
  if (REBUILD_PALETTES.has(previousPalette) || REBUILD_PALETTES.has(preset)) {
    actions.rebuildGraph(nextConfig).catch(err => reportDemoControlError(actions, err))
  } else {
    actions.applyVisualControls()
  }
}
