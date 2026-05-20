import type { WorkFocusControllerOptions } from './contracts'
import { WORK_MODE_INTERACTION } from '../work-mode/profile'

export type WorkPreviewState = { type: 'point-far' | 'point-close' | 'link'; index: number }

export function isCloseWorkZoom (options: WorkFocusControllerOptions): boolean {
  return (options.getCurrentGraph()?.getZoomDistance?.() ?? 100) <= WORK_MODE_INTERACTION.closeZoomDistance
}
