import { initNodeTreatmentLabControls } from './features/node-treatment-lab/controls'
import { DEFAULT_LAB_STATE } from './features/node-treatment-lab/presets'
import type { LabState } from './features/node-treatment-lab/types'

const state: LabState = { ...DEFAULT_LAB_STATE }

export function initNodeTreatmentLab (): void {
  initNodeTreatmentLabControls(state)
}
