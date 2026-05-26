import { atlasHash } from './metrics'
import { atlasColorForGroup } from './overlay-geometry'
import type { AtlasDrawPoint } from './overlay-point'
import type { OverlayView } from './overlay-types'

interface ScreenPoint extends AtlasDrawPoint {
  sx: number;
  sy: number;
  sr: number;
}

export function drawScreenAtlas (
  g: CanvasRenderingContext2D,
  seed: number,
  view: OverlayView,
): number {
  const points = (view.points ?? []).map((point) => screenPoint(point, view))
  const glyphs = points.filter((point) => !point.texture)
  drawTexture(g, points.filter((point) => point.texture))
  drawFilaments(g, glyphs, seed)
  for (const point of glyphs) {
    const color = atlasColorForGroup(point.group)
    const boost = 0.78 + atlasHash(point.node * 101, seed) * 0.58
    drawMoat(g, point.sx, point.sy, point.sr)
    drawCore(g, point.sx, point.sy, point.sr, color, boost)
  }
  return glyphs.length
}

function screenPoint (point: AtlasDrawPoint, view: OverlayView): ScreenPoint {
  return {
    ...point,
    sx: project(point.x, view.width, view.scale, view.panX),
    sy: project(point.y, view.height, view.scale, view.panY),
    sr: Math.max(1.15, point.r * view.scale),
  }
}

function drawFilaments (g: CanvasRenderingContext2D, points: ScreenPoint[], seed: number): void {
  g.lineCap = 'round'
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!
    if (atlasHash(a.node * 211, seed) < 0.24) continue
    const b = points[(i + 17 + Math.floor(atlasHash(a.node * 17, seed) * 89)) % points.length]
    if (!b || a.group !== b.group && atlasHash(a.node * 31, seed) < 0.72) continue
    const dx = a.sx - b.sx
    const dy = a.sy - b.sy
    if (dx * dx + dy * dy > 150000) continue
    const color = atlasColorForGroup(a.group)
    g.beginPath()
    g.moveTo(a.sx, a.sy)
    g.lineTo(b.sx, b.sy)
    g.strokeStyle = `rgba(${rgb(color[0], 0.72)},${rgb(color[1], 0.72)},${rgb(color[2], 0.72)},0.16)`
    g.lineWidth = Math.max(0.32, Math.min(1.25, (a.sr + b.sr) * 0.035))
    g.stroke()
  }
}

function drawTexture (g: CanvasRenderingContext2D, points: ScreenPoint[]): void {
  for (const point of points) {
    const color = atlasColorForGroup(point.group)
    g.beginPath()
    g.arc(point.sx, point.sy, Math.max(0.38, point.sr), 0, Math.PI * 2)
    g.fillStyle = `rgba(${rgb(color[0], 0.98)},${rgb(color[1], 0.98)},${rgb(color[2], 0.98)},0.24)`
    g.fill()
  }
}

function drawMoat (g: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  g.beginPath()
  g.arc(x, y, radius + Math.max(0.48, radius * 0.18), 0, Math.PI * 2)
  g.fillStyle = '#000'
  g.fill()
}

function drawCore (
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: readonly [number, number, number],
  boost: number,
): void {
  g.beginPath()
  g.arc(x, y, radius, 0, Math.PI * 2)
  g.fillStyle = corePaint(g, x, y, radius, color, boost)
  g.fill()
}

function corePaint (
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: readonly [number, number, number],
  boost: number,
): CanvasGradient | string {
  const base = `rgb(${rgb(color[0], boost)},${rgb(color[1], boost)},${rgb(color[2], boost)})`
  if (radius < 2.2) return base
  const bright = `rgb(${rgb(color[0], boost * 1.55)},${rgb(color[1], boost * 1.55)},${rgb(color[2], boost * 1.55)})`
  const shade = `rgb(${rgb(color[0], boost * 0.52)},${rgb(color[1], boost * 0.52)},${rgb(color[2], boost * 0.52)})`
  const paint = g.createRadialGradient(x - radius * 0.38, y - radius * 0.42, radius * 0.06, x, y, radius)
  paint.addColorStop(0, radius > 5.5 ? '#ffffff' : bright)
  paint.addColorStop(0.18, bright)
  paint.addColorStop(0.58, base)
  paint.addColorStop(1, shade)
  return paint
}

function project (value: number, extent: number, scale: number, pan: number): number {
  return extent * 0.5 + (value - extent * 0.5) * scale + pan
}

function rgb (channel: number, boost: number): number {
  return Math.max(0, Math.min(255, Math.round(channel * boost * 255)))
}
