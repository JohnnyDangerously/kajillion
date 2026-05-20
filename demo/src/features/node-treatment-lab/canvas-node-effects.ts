import { colorString, darken, hexToRgb, lighten, mixRgb, rgbString } from './canvas-color'
import type { LabState } from './types'

export function drawDepthShadow (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  depth: number,
): void {
  const shadow = ctx.createRadialGradient(
    x + radius * 0.20,
    y + radius * (0.22 + depth * 0.10),
    radius * 0.18,
    x + radius * 0.20,
    y + radius * (0.22 + depth * 0.10),
    radius * (1.52 + depth * 0.35)
  )
  shadow.addColorStop(0, 'rgba(15,23,42,0.22)')
  shadow.addColorStop(0.58, 'rgba(15,23,42,0.08)')
  shadow.addColorStop(1, 'rgba(15,23,42,0)')
  ctx.fillStyle = shadow
  ctx.beginPath()
  ctx.ellipse(x + radius * 0.14, y + radius * 0.28, radius * 1.12, radius * 0.58, -0.08, 0, Math.PI * 2)
  ctx.fill()
}

export function drawNodeGlow (
  state: LabState,
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  base: string,
): void {
  const glowRadius = radius * (state.treatment === 'vip' ? 3.2 : 2.5)
  const glow = ctx.createRadialGradient(x, y, radius * 0.52, x, y, glowRadius)
  glow.addColorStop(0, rgbString(hexToRgb(base), state.lighting === 'depth' ? 0.16 : 0.26))
  glow.addColorStop(0.58, rgbString(hexToRgb(base), state.lighting === 'depth' ? 0.045 : 0.08))
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(x, y, glowRadius, 0, Math.PI * 2)
  ctx.fill()
}

export function applyNodeFill (
  state: LabState,
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  base: string,
): void {
  if (state.lighting === 'flat') {
    ctx.fillStyle = base
  } else if (state.lighting === 'glass') {
    const glass = ctx.createRadialGradient(x - radius * 0.34, y - radius * 0.42, radius * 0.06, x, y, radius * 1.08)
    glass.addColorStop(0, 'rgba(255,255,255,0.94)')
    glass.addColorStop(0.22, colorString(base, 0.82))
    glass.addColorStop(0.58, colorString(base, 0.58))
    glass.addColorStop(1, rgbString(mixRgb(hexToRgb(base), [8, 20, 36], 0.24), 0.70))
    ctx.fillStyle = glass
  } else {
    const sphere = ctx.createRadialGradient(x - radius * 0.36, y - radius * 0.40, radius * 0.10, x, y, radius * 1.18)
    sphere.addColorStop(0, lighten(base, state.lighting === 'specular' || state.lighting === 'depth' ? 0.72 : 0.42))
    sphere.addColorStop(0.36, base)
    sphere.addColorStop(1, darken(base, state.lighting === 'depth' ? 0.46 : 0.34))
    ctx.fillStyle = sphere
  }
}

export function drawSurfaceHighlights (
  state: LabState,
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  dpr: number,
): void {
  ctx.strokeStyle = 'rgba(255,255,255,0.72)'
  ctx.lineWidth = Math.max(1 * dpr, radius * 0.045)
  ctx.beginPath()
  ctx.arc(x - radius * 0.08, y - radius * 0.08, radius * 0.72, Math.PI * 1.08, Math.PI * 1.86)
  ctx.stroke()
  ctx.fillStyle = state.lighting === 'glass' ? 'rgba(255,255,255,0.86)' : 'rgba(255,255,255,0.78)'
  ctx.beginPath()
  ctx.ellipse(x - radius * 0.30, y - radius * 0.35, radius * 0.16, radius * 0.09, -0.38, 0, Math.PI * 2)
  ctx.fill()
  if (state.lighting !== 'depth') return

  ctx.strokeStyle = 'rgba(15,23,42,0.16)'
  ctx.lineWidth = Math.max(1 * dpr, radius * 0.032)
  ctx.beginPath()
  ctx.arc(x + radius * 0.03, y + radius * 0.03, radius * 0.86, Math.PI * 0.20, Math.PI * 0.82)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.34)'
  ctx.beginPath()
  ctx.arc(x - radius * 0.02, y - radius * 0.02, radius * 0.94, Math.PI * 1.06, Math.PI * 1.72)
  ctx.stroke()
}

export function drawGlassRing (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, dpr: number): void {
  ctx.save()
  ctx.globalAlpha = 0.40
  ctx.strokeStyle = 'rgba(255,255,255,0.94)'
  ctx.lineWidth = Math.max(1 * dpr, radius * 0.030)
  ctx.beginPath()
  ctx.arc(x, y, radius * 0.82, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

export function drawSelectionRing (
  state: LabState,
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  base: string,
  dpr: number,
): void {
  ctx.strokeStyle = state.treatment === 'vip' ? 'rgba(251,191,36,0.78)' : lighten(base, 0.50)
  ctx.lineWidth = 2 * dpr
  ctx.beginPath()
  ctx.arc(x, y, radius + 8 * dpr, 0, Math.PI * 2)
  ctx.stroke()
}

export function drawSparkles (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, dpr: number): void {
  const rgb = hexToRgb(color)
  ctx.save()
  ctx.fillStyle = rgbString(mixRgb(rgb, [255, 255, 255], 0.55), 0.86)
  for (let i = 0; i < 7; i += 1) {
    const angle = i * 2.399963229728653
    const distance = radius * (0.18 + (i % 4) * 0.16)
    const px = x + Math.cos(angle) * distance
    const py = y + Math.sin(angle) * distance
    const r = Math.max(1.1 * dpr, radius * (i % 2 === 0 ? 0.055 : 0.035))
    ctx.beginPath()
    ctx.arc(px, py, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}
