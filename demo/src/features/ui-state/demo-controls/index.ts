import {
  applyDepthPresetToControls,
  isWorkMode,
  readControls,
  syncTuningLabels,
} from '../../control-plane/controls'
import type { ControlElements, FocusElements } from '../../control-plane/dom'
import type { DepthPreset } from '../../control-plane/types'
import { isGalleryPalette, parsePaletteParam } from '../../../gallery-presets'
import { syncToggleButtonLabels } from '../mode-readout'
import {
  applyGalleryPreset,
  setGalleryOpen as setGalleryOpenState,
  syncGalleryButtons as syncGalleryButtonState,
} from './gallery'
import { reportDemoControlError } from './errors'
import type { DemoControlActions, DemoControlController } from './types'

export type { DemoControlController } from './types'

export function installDemoControls (
  ctlEl: ControlElements,
  focusEl: FocusElements,
  actions: DemoControlActions
): DemoControlController {
  function runControlChange (): void {
    actions.applyControlChange().catch(err => reportDemoControlError(actions, err))
  }

  function syncNodeButtons (): void {
    for (const button of ctlEl.nButtons) {
      const isActive = button.dataset.n === ctlEl.n.value &&
        (!button.dataset.mode || button.dataset.mode === ctlEl.data.value)
      button.classList.toggle('active', isActive)
      button.setAttribute('aria-pressed', String(isActive))
    }
  }

  function syncDependentControls (): void {
    ctlEl.webgpu.checked = true
    const cfg = actions.getCurrentConfig() ?? readControls(ctlEl)
    const isWork = isWorkMode(cfg)
    const isLight = !ctlEl.theme.classList.contains('active')
    const palette = cfg.palette
    const blendForced = isWork || isLight || isGalleryPalette(palette) || (cfg.lod && !isWork && cfg.n >= 50000)
    const adaptiveDprActive = !isLight && palette !== 'cosmic'
    ctlEl.webgpu.disabled = true
    ctlEl.msaa.disabled = false
    ctlEl.adpr.disabled = !adaptiveDprActive
    ctlEl.blend.disabled = blendForced
    ctlEl.sim.disabled = isWork && !cfg.explore
    ctlEl.msaaRow.classList.toggle('is-disabled', ctlEl.msaa.disabled)
    ctlEl.adprRow.classList.toggle('is-disabled', ctlEl.adpr.disabled)
    ctlEl.blendRow.classList.toggle('is-disabled', ctlEl.blend.disabled)
    ctlEl.simRow.classList.toggle('is-disabled', ctlEl.sim.disabled)
    ctlEl.adprRow.title = adaptiveDprActive ? '' : 'Adaptive DPR is only active in dark non-cosmic modes.'
    ctlEl.blendRow.title = blendForced ? 'Blend mode is forced by the current theme/palette to avoid bad compositing.' : ''
    ctlEl.simRow.title = ctlEl.sim.disabled ? 'The work graph uses a baked layout; simulation is for generated/explore graphs.' : ''
  }

  function syncGalleryButtons (): void {
    syncGalleryButtonState(ctlEl, actions.getCurrentConfig())
  }

  function syncToggleButtons (): void {
    syncDependentControls()
    syncToggleButtonLabels(ctlEl, actions.getCurrentConfig())
    syncGalleryButtons()
  }

  function setGalleryOpen (open: boolean): void {
    setGalleryOpenState(ctlEl, open)
  }

  for (const button of ctlEl.nButtons) {
    button.addEventListener('click', () => {
      if (!button.dataset.n) return
      ctlEl.n.value = button.dataset.n
      if (button.dataset.mode === 'work') ctlEl.data.value = 'work'
      else if (ctlEl.data.value === 'work') ctlEl.data.value = 'cosmo'
      syncNodeButtons()
      runControlChange()
    })
  }

  ;[ctlEl.n, ctlEl.data, ctlEl.seed, ctlEl.webgpu, ctlEl.msaa, ctlEl.adpr, ctlEl.blend, ctlEl.frameCap, ctlEl.sim]
    .forEach(el => el.addEventListener('change', () => {
      if (el === ctlEl.data && ctlEl.data.value === 'work') ctlEl.n.value = '4000'
      else if (el === ctlEl.data && ctlEl.data.value !== 'work' && (ctlEl.n.value === '500' || ctlEl.n.value === '4000')) ctlEl.n.value = '10000'
      syncDependentControls()
      syncNodeButtons()
      runControlChange()
    }))

  for (const button of [ctlEl.density, ctlEl.edges, ctlEl.lod, ctlEl.lanes, ctlEl.tilt]) {
    button.addEventListener('click', () => {
      button.classList.toggle('active')
      actions.applyVisualControls()
    })
  }

  ctlEl.theme.addEventListener('click', () => {
    ctlEl.theme.classList.toggle('active')
    actions.applyVisualControls()
  })

  ctlEl.depthPreset.addEventListener('change', () => {
    const preset = ctlEl.depthPreset.value as DepthPreset
    applyDepthPresetToControls(ctlEl, preset)
    actions.applyVisualControls()
  })

  for (const input of [
    ctlEl.depthStrength,
    ctlEl.depthSize,
    ctlEl.depthBrightness,
    ctlEl.depthOpacity,
    ctlEl.depthMoat,
    ctlEl.depthHighlight,
    ctlEl.depthShadow,
    ctlEl.depthSaturation,
    ctlEl.tileBudget,
    ctlEl.tileSize,
    ctlEl.tileMaxScale,
  ]) {
    input.addEventListener('input', () => {
      if (
        input === ctlEl.depthStrength ||
        input === ctlEl.depthSize ||
        input === ctlEl.depthBrightness ||
        input === ctlEl.depthOpacity ||
        input === ctlEl.depthMoat ||
        input === ctlEl.depthHighlight ||
        input === ctlEl.depthShadow ||
        input === ctlEl.depthSaturation
      ) {
        ctlEl.depthPreset.value = 'custom'
      }
      syncTuningLabels(ctlEl)
      actions.scheduleVisualControls()
    })
    input.addEventListener('change', () => {
      syncTuningLabels(ctlEl)
      actions.applyVisualControls()
    })
  }

  focusEl.overview.addEventListener('click', () => {
    actions.clearWorkFocus(true)
  })

  focusEl.neighbors.addEventListener('click', () => {
    actions.fitWorkNeighborhood()
  })

  focusEl.step.addEventListener('click', () => {
    actions.stepIntoWorkPoint()
  })

  ctlEl.galleryTab.addEventListener('click', () => {
    setGalleryOpen(!ctlEl.gallery.classList.contains('open'))
  })

  ctlEl.galleryClose.addEventListener('click', () => {
    setGalleryOpen(false)
  })

  for (const card of ctlEl.presetCards) {
    card.addEventListener('click', () => {
      applyGalleryPreset(ctlEl, actions, parsePaletteParam(card.dataset.preset ?? null), syncToggleButtons)
    })
  }

  return {
    syncNodeButtons,
    syncDependentControls,
    syncToggleButtons,
    setGalleryOpen,
  }
}
