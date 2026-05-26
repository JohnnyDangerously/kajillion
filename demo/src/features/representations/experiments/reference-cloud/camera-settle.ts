import type { CloudView } from './types'

const timers = new WeakMap<HTMLCanvasElement, number>()

export function scheduleSettledRedraw (canvas: HTMLCanvasElement, view: CloudView, redraw: () => void, delay = 140): void {
  clearSettledRedraw(canvas)
  const timer = window.setTimeout(() => {
    bakeDisplayTransform(view)
    redraw()
  }, delay)
  timers.set(canvas, timer)
}

export function clearSettledRedraw (canvas: HTMLCanvasElement): void {
  const timer = timers.get(canvas)
  if (timer !== undefined) window.clearTimeout(timer)
  timers.delete(canvas)
}

function bakeDisplayTransform (view: CloudView): void {
  if (view.displayScale === 1 && view.displayPanX === 0 && view.displayPanY === 0) return
  view.scale = clamp(view.scale * view.displayScale, 0.45, 6.5)
  view.panX = view.displayPanX + view.displayScale * view.panX
  view.panY = view.displayPanY + view.displayScale * view.panY
  view.displayScale = 1
  view.displayPanX = 0
  view.displayPanY = 0
}

function clamp (value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
