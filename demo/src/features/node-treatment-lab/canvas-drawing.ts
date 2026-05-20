import { clamp } from './treatment-helpers'
import type { LabNode, LabState } from './types'
import { darken, lighten, rgbString } from './canvas-color'
import {
  applyNodeFill,
  drawDepthShadow,
  drawGlassRing,
  drawNodeGlow,
  drawSelectionRing,
  drawSparkles,
  drawSurfaceHighlights,
} from './canvas-node-effects'
import { screenR, screenX, screenY } from './canvas-space'

function borderColor (state: LabState, base: string): string {
  switch (state.border) {
    case 'black': return 'rgba(15,23,42,0.82)'
    case 'white': return 'rgba(255,255,255,0.92)'
    case 'same-bright': return lighten(base, 0.32)
    case 'same-dark': return darken(base, 0.38)
    case 'double': return darken(base, 0.34)
    case 'none': return 'rgba(0,0,0,0)'
  }
}

export function drawField (ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number): void {
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#fbfdff')
  gradient.addColorStop(0.58, '#f7faff')
  gradient.addColorStop(1, '#eef4fb')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  ctx.save()
  ctx.strokeStyle = 'rgba(148,163,184,0.10)'
  ctx.lineWidth = 1 * dpr
  const step = 44 * dpr
  for (let x = step; x < width; x += step) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }
  for (let y = step; y < height; y += step) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }
  ctx.restore()

  ctx.save()
  ctx.fillStyle = 'rgba(71,85,105,0.52)'
  ctx.font = `${Math.round(11 * dpr)}px ui-monospace, SFMono-Regular, monospace`
  ctx.textBaseline = 'top'
  ctx.fillText('wheel to zoom, drag to pan', 16 * dpr, 14 * dpr)
  ctx.restore()
}

export function drawEdge (
  state: LabState,
  ctx: CanvasRenderingContext2D,
  a: LabNode,
  b: LabNode,
  width: number,
  height: number,
  dpr: number,
  strength = 1,
): void {
  const ax = screenX(state, a.x, width, dpr)
  const ay = screenY(state, a.y, height, dpr)
  const bx = screenX(state, b.x, width, dpr)
  const by = screenY(state, b.y, height, dpr)
  const z = state.zoom / 100
  const cx = (ax + bx) / 2
  const cy = Math.min(ay, by) - 72 * dpr * z
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.quadraticCurveTo(cx, cy, bx, by)
  const edgeRgb = state.palette === 'dark' ? [38, 45, 62] : state.palette === 'neon' ? [20, 95, 130] : [91, 105, 128]
  ctx.strokeStyle = rgbString(edgeRgb as [number, number, number], state.scene === 'cluster' ? 0.18 * strength : 0.34 * strength)
  ctx.lineWidth = Math.max(1, 2.2 * dpr * Math.sqrt(z) * strength)
  ctx.stroke()
  ctx.restore()
}

function drawLabel (
  state: LabState,
  ctx: CanvasRenderingContext2D,
  node: LabNode,
  x: number,
  y: number,
  radius: number,
  dpr: number,
): void {
  if (!node.label || state.zoom < 62) return
  const labelScale = clamp(state.zoom / 100, 0.70, 1.65)
  const fontSize = Math.round(11 * dpr * labelScale)
  ctx.save()
  ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, monospace`
  const textWidth = ctx.measureText(node.label).width
  const padX = 8 * dpr * labelScale
  const labelWidth = textWidth + padX * 2
  const labelHeight = 22 * dpr * labelScale
  const left = x - labelWidth / 2
  const top = y + radius + 8 * dpr
  ctx.fillStyle = 'rgba(248,250,252,0.82)'
  ctx.strokeStyle = 'rgba(71,85,105,0.20)'
  ctx.lineWidth = 1 * dpr
  ctx.beginPath()
  ctx.roundRect(left, top, labelWidth, labelHeight, 5 * dpr)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = 'rgba(51,65,85,0.90)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(node.label, x, top + labelHeight / 2)
  ctx.restore()
}

export function drawNode (
  state: LabState,
  ctx: CanvasRenderingContext2D,
  node: LabNode,
  width: number,
  height: number,
  dpr: number,
): void {
  const x = screenX(state, node.x, width, dpr)
  const y = screenY(state, node.y, height, dpr)
  const radius = Math.max(1.6 * dpr, screenR(state, node.radius, dpr))
  const base = node.color
  const border = borderColor(state, base)
  const selected = node.selected || state.treatment === 'selected'
  const blur = state.sharpness === 'soft' ? radius * 0.30 : state.sharpness === 'sparkle' ? radius * 0.18 : radius * 0.08

  ctx.save()
  if (state.lighting === 'depth') {
    drawDepthShadow(ctx, x, y, radius, node.depth ?? 0.5)
  }

  if (state.lighting === 'halo' || state.lighting === 'depth' || selected || state.treatment === 'vip') {
    drawNodeGlow(state, ctx, x, y, radius, base)
  }

  ctx.shadowColor = state.sharpness === 'ink' ? 'rgba(0,0,0,0)' : 'rgba(15,23,42,0.18)'
  ctx.shadowBlur = state.lighting === 'depth' ? Math.max(blur, radius * 0.18) : blur
  ctx.shadowOffsetY = state.lighting === 'depth' ? radius * 0.10 : state.sharpness === 'soft' ? radius * 0.08 : radius * 0.035

  applyNodeFill(state, ctx, x, y, radius, base)

  ctx.strokeStyle = border
  ctx.lineWidth = state.border === 'none' ? 0 : (state.sharpness === 'ink' ? 3.2 : state.border === 'double' ? 2.2 : 1.9) * dpr
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  if (ctx.lineWidth > 0) ctx.stroke()
  ctx.shadowBlur = 0

  if (state.border === 'double') {
    ctx.strokeStyle = lighten(base, 0.48)
    ctx.lineWidth = Math.max(1 * dpr, radius * 0.055)
    ctx.beginPath()
    ctx.arc(x, y, radius + Math.max(4 * dpr, radius * 0.12), 0, Math.PI * 2)
    ctx.stroke()
  }

  if (state.lighting === 'glass' || state.lighting === 'specular' || state.lighting === 'depth') {
    drawSurfaceHighlights(state, ctx, x, y, radius, dpr)
  }

  if (state.lighting === 'glass') {
    drawGlassRing(ctx, x, y, radius, dpr)
  }

  if (selected || state.treatment === 'vip') {
    drawSelectionRing(state, ctx, x, y, radius, base, dpr)
  }

  if (state.sharpness === 'sparkle') drawSparkles(ctx, x, y, radius, base, dpr)

  drawLabel(state, ctx, node, x, y, radius, dpr)
  ctx.restore()
}
