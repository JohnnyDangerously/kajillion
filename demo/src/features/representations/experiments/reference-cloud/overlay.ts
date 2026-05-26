import type { RepresentationInstallContext } from '../../types'
import { fitReferenceCloudView } from './fit'
import { drawReferenceCloud } from './render'
import { buildCachedReferenceCloudScene, getReferenceCloudScene } from './scene-cache'
import type { CloudView } from './types'

export function installReferenceCloudOverlay (ctx: RepresentationInstallContext): (() => void) {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:absolute;inset:0;z-index:4;pointer-events:auto;cursor:grab'
  ctx.host.style.position = 'relative'
  ctx.host.append(canvas)
  const view = createView()
  const seed = ctx.config.seed || 1
  view.scene = getReferenceCloudScene(ctx.data.nodeCount, seed)
  const redraw = (): void => draw(canvas, view, seed)
  const observer = new ResizeObserver(redraw)
  const wheel = (event: WheelEvent): void => onWheel(event, canvas, view, redraw)
  const down = (event: PointerEvent): void => onDown(event, canvas, view)
  const move = (event: PointerEvent): void => onMove(event, canvas, view, redraw)
  const up = (): void => onUp(canvas, view, redraw)
  requestAnimationFrame(redraw)
  const buildTimer = window.setTimeout(() => {
    if (!view.scene) view.scene = buildCachedReferenceCloudScene(ctx.data.nodeCount, seed)
    redraw()
  }, 0)
  observer.observe(ctx.host)
  canvas.addEventListener('wheel', wheel, { passive: false })
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', up)
  window.addEventListener('resize', redraw)
  return () => {
    window.removeEventListener('resize', redraw)
    window.clearTimeout(buildTimer)
    observer.disconnect()
    canvas.removeEventListener('wheel', wheel)
    canvas.removeEventListener('pointerdown', down)
    canvas.removeEventListener('pointermove', move)
    canvas.removeEventListener('pointerup', up)
    canvas.removeEventListener('pointercancel', up)
    canvas.remove()
  }
}

function createView (): CloudView {
  return {
    scene: null, width: 0, height: 0, scale: 1, panX: 0, panY: 0, displayScale: 1, displayPanX: 0, displayPanY: 0, autoFit: true,
    roll: -0.035, yaw: 0.16, pitch: -0.11, dragX: 0, dragY: 0, dragging: false, interactionUntil: 0, acceptedGlyphs: new Set(),
  }
}

function draw (canvas: HTMLCanvasElement, view: CloudView, seed: number): void {
  const rect = (canvas.parentElement ?? canvas).getBoundingClientRect()
  if (rect.width < 2 || rect.height < 2) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const pixelWidth = Math.max(1, Math.floor(rect.width * dpr))
  const pixelHeight = Math.max(1, Math.floor(rect.height * dpr))
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight
  canvas.style.width = `${rect.width}px`
  canvas.style.height = `${rect.height}px`
  view.width = rect.width
  view.height = rect.height
  fitReferenceCloudView(view)
  view.displayScale = 1
  view.displayPanX = 0
  view.displayPanY = 0
  const g = canvas.getContext('2d')
  if (!g) return
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  if (!view.scene) {
    drawLoading(g, view.width, view.height)
    return
  }
  drawReferenceCloud(g, view, seed)
}

function drawLoading (g: CanvasRenderingContext2D, width: number, height: number): void {
  g.fillStyle = '#000'
  g.fillRect(0, 0, width, height)
  g.fillStyle = 'rgba(220,235,255,0.72)'
  g.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace'
  g.fillText('building atlas...', width * 0.5 - 56, height * 0.52)
}

function onWheel (event: WheelEvent, canvas: HTMLCanvasElement, view: CloudView, redraw: () => void): void {
  event.preventDefault()
  const rect = canvas.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const old = view.scale
  view.autoFit = false
  view.interactionUntil = performance.now() + 240
  const next = Math.max(0.72, Math.min(5.8, old * Math.exp(-event.deltaY * 0.0028)))
  view.panX = zoomPan(view.panX, x, rect.width, old, next)
  view.panY = zoomPan(view.panY, y, rect.height, old, next)
  view.scale = next
  redraw()
}

function zoomPan (pan: number, cursor: number, extent: number, oldScale: number, nextScale: number): number {
  return cursor - extent * 0.5 - ((cursor - extent * 0.5 - pan) / oldScale) * nextScale
}

function onDown (event: PointerEvent, canvas: HTMLCanvasElement, view: CloudView): void {
  view.dragging = true
  view.autoFit = false
  view.interactionUntil = performance.now() + 240
  view.dragX = event.clientX
  view.dragY = event.clientY
  canvas.style.cursor = 'grabbing'
  canvas.setPointerCapture(event.pointerId)
}

function onMove (event: PointerEvent, canvas: HTMLCanvasElement, view: CloudView, redraw: () => void): void {
  if (!view.dragging) return
  view.interactionUntil = performance.now() + 240
  view.panX += event.clientX - view.dragX
  view.panY += event.clientY - view.dragY
  view.dragX = event.clientX
  view.dragY = event.clientY
  redraw()
}

function onUp (canvas: HTMLCanvasElement, view: CloudView, _redraw: () => void): void {
  view.dragging = false
  view.interactionUntil = performance.now() + 160
  canvas.style.cursor = 'grab'
}
