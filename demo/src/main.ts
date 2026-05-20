import {
  hydrateControlsFromUrl,
  readControls,
} from './features/control-plane/controls'
import { createControlElements, createFocusElements, createOverlayElements } from './features/control-plane/dom'
import { createInitialDemoRuntimeState } from './features/demo-runtime/runtime-state'
import { installDemoShell } from './features/demo-shell/install-demo-shell'
import './gallery-presets.css'
import { startDemoRuntime } from './main-runtime'

installDemoShell()

const overlayEl = createOverlayElements()
const ctlEl = createControlElements()
const focusEl = createFocusElements()

hydrateControlsFromUrl(ctlEl)
const demoState = createInitialDemoRuntimeState(readControls(ctlEl))

startDemoRuntime({
  state: demoState,
  overlayEl,
  ctlEl,
  focusEl,
})
