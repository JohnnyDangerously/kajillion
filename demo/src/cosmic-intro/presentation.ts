import type { Graph } from '@kajillion/graph'
import { readControls } from '../features/control-plane/controls'
import type { ControlElements } from '../features/control-plane/dom'
import type { DemoConfig } from '../features/control-plane/types'
import { CosmicIntroRenderer } from './CosmicIntroRenderer'

type CosmicPresentationState = 'none' | 'intro' | 'dive'

interface CosmicIntroPresentationOptions {
  ctlEl: ControlElements;
  getCurrentConfig: () => DemoConfig;
  setCurrentConfig: (cfg: DemoConfig) => void;
  getCurrentGraph: () => Graph | null;
  applyTheme: (theme: DemoConfig['theme']) => void;
  handleError?: (err: unknown) => void;
}

export interface CosmicIntroPresentationController {
  syncPresentation: (theme: DemoConfig['theme']) => void;
  resetDismissal: () => void;
  dispose: () => void;
}

export function createCosmicIntroPresentationController (
  options: CosmicIntroPresentationOptions
): CosmicIntroPresentationController {
  let presentationState: CosmicPresentationState = 'none'
  let renderer: CosmicIntroRenderer | null = null
  let dismissed = false

  const reportError = (err: unknown): void => {
    if (options.handleError) options.handleError(err)
    else console.error(err)
  }

  const ensureRenderer = (): void => {
    if (renderer) {
      renderer.start()
      return
    }
    renderer = new CosmicIntroRenderer({
      host: options.ctlEl.cosmicIntroLayer,
      diveDurationMs: 2100,
    })
    renderer.start()
  }

  const disposeRenderer = (): void => {
    if (!renderer) return
    renderer.dispose()
    renderer = null
  }

  const syncPresentation = (theme: DemoConfig['theme']): void => {
    const currentConfig = options.getCurrentConfig()
    const wantsIntro = currentConfig.palette === 'cosmic' && theme === 'dark' && !dismissed
    if (presentationState !== 'dive') {
      presentationState = wantsIntro ? 'intro' : 'none'
    }
    document.documentElement.dataset.presentation = presentationState === 'none'
      ? 'default'
      : `cosmic-${presentationState}`
    const introVisible = presentationState === 'intro'
    options.ctlEl.cosmicIntro.hidden = !introVisible
    options.ctlEl.cosmicIntroLayer.hidden = presentationState === 'none'
    options.ctlEl.cosmicIntroLayer.classList.toggle('active', presentationState !== 'none')
    options.ctlEl.cosmicIntroLayer.classList.toggle('diving', presentationState === 'dive')
    if (presentationState !== 'none') {
      ensureRenderer()
    } else {
      disposeRenderer()
    }
    if (introVisible) options.ctlEl.cosmicIntro.classList.remove('entered')
    else if (presentationState === 'none') options.ctlEl.cosmicIntro.classList.remove('entered')
  }

  options.ctlEl.cosmicBegin.addEventListener('click', () => {
    const graph = options.getCurrentGraph()
    if (!graph) return
    ensureRenderer()
    dismissed = true
    presentationState = 'dive'
    document.documentElement.dataset.presentation = 'cosmic-dive'
    options.ctlEl.cosmicIntroLayer.hidden = false
    options.ctlEl.cosmicIntroLayer.classList.add('active', 'diving')
    options.ctlEl.cosmicIntro.classList.add('entered')
    options.ctlEl.tilt.classList.remove('active')
    const currentConfig = readControls(options.ctlEl)
    options.setCurrentConfig(currentConfig)
    document.documentElement.dataset.tilt = 'off'
    graph.zoomToPointByIndex(0, 1800, 2.15, true, false)
    const dive = renderer?.beginDive() ?? Promise.resolve()
    dive.then(() => {
      if (presentationState !== 'dive') return
      presentationState = 'none'
      options.applyTheme(options.getCurrentConfig().theme)
      graph.render()
    }).catch(reportError)
  })

  return {
    syncPresentation,
    resetDismissal: () => { dismissed = false },
    dispose: disposeRenderer,
  }
}
