import type { LabState } from './types'

export function resizeCanvas (canvas: HTMLCanvasElement): number {
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2))
  const rect = canvas.getBoundingClientRect()
  const width = Math.max(1, Math.round(rect.width * dpr))
  const height = Math.max(1, Math.round(rect.height * dpr))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  return dpr
}

export function screenX (state: LabState, worldX: number, width: number, dpr: number): number {
  return width / 2 + (worldX + state.panX) * dpr * (state.zoom / 100)
}

export function screenY (state: LabState, worldY: number, height: number, dpr: number): number {
  return height / 2 + (worldY + state.panY) * dpr * (state.zoom / 100)
}

export function screenR (state: LabState, radius: number, dpr: number): number {
  return radius * dpr * (state.zoom / 100)
}
