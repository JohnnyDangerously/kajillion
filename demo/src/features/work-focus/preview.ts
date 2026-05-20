import type { WorkFocusControllerOptions } from './contracts'

export type WorkPreviewState = { type: 'point-far' | 'point-close' | 'link'; index: number }

export function isCloseWorkZoom (options: WorkFocusControllerOptions): boolean {
  return (options.getCurrentGraph()?.getZoomDistance?.() ?? 100) <= 25
}
