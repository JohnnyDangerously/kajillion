import type { RepresentationInstallContext } from '../../types'
import { buildAtlasDrawPoints } from './overlay-geometry'
import { drawScreenAtlas } from './overlay-render'
import type { OverlayView } from './overlay-types'

export function installAtlasOverviewOverlay (ctx: RepresentationInstallContext): (() => void) | void {
  if (ctx.data.nodeCount < 50000) return undefined
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:absolute;inset:0;pointer-events:auto;z-index:1;cursor:grab'
  ctx.host.style.position = 'relative'
  ctx.host.append(canvas)
  const view = createOverlayView()
  const redraw = (): void => drawAtlas(canvas, ctx, view)
  const wheel = (event: WheelEvent): void => handleWheel(event, canvas, view, redraw)
  const down = (event: PointerEvent): void => handlePointerDown(event, canvas, view)
  const move = (event: PointerEvent): void => handlePointerMove(event, view, redraw)
  const up = (): void => handlePointerUp(canvas, view)
  const resize = (): void => {
    view.points = null
    redraw()
  }
  resize()
  canvas.addEventListener('wheel', wheel, { passive: false })
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', up)
  window.addEventListener('resize', resize)
  return () => {
    window.removeEventListener('resize', resize)
    canvas.removeEventListener('wheel', wheel)
    canvas.removeEventListener('pointerdown', down)
    canvas.removeEventListener('pointermove', move)
    canvas.removeEventListener('pointerup', up)
    canvas.removeEventListener('pointercancel', up)
    canvas.remove()
  }
}

function drawAtlas (canvas: HTMLCanvasElement, ctx: RepresentationInstallContext, view: OverlayView): void {
  const rect = ctx.host.getBoundingClientRect()
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = Math.max(1, Math.floor(rect.width * dpr))
  canvas.height = Math.max(1, Math.floor(rect.height * dpr))
  canvas.style.width = `${rect.width}px`
  canvas.style.height = `${rect.height}px`
  const g = canvas.getContext('2d')
  if (!g) return
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, rect.width, rect.height)
  g.fillStyle = '#000'
  g.fillRect(0, 0, rect.width, rect.height)
  if (!view.points || view.width !== rect.width || view.height !== rect.height) {
    view.width = rect.width
    view.height = rect.height
    view.points = buildAtlasDrawPoints(ctx.data.nodeCount, ctx.config.seed || 1, rect.width, rect.height)
  }
  const drawn = drawScreenAtlas(g, ctx.config.seed || 1, view)
  exposeAtlasDebug({
    drawn,
    rect: { width: rect.width, height: rect.height },
    acceptedFullGlyphCount: drawn,
    rejectedDueToOcclusionCount: 0,
    rejectedTextureRenderCount: 0,
    layoutMutationDuringRender: false,
    globalCollisionTriggered: false,
    textureLayerEnabled: false,
  })
}

function exposeAtlasDebug (value: unknown): void {
  ;(window as unknown as { __atlasOverlayDebug?: unknown }).__atlasOverlayDebug = value
}

function createOverlayView (): OverlayView {
  return { points: null, width: 0, height: 0, scale: 1, panX: 0, panY: 0, dragX: 0, dragY: 0, dragging: false }
}

function handleWheel (event: WheelEvent, canvas: HTMLCanvasElement, view: OverlayView, redraw: () => void): void {
  event.preventDefault()
  const rect = canvas.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const old = view.scale
  const next = Math.max(0.65, Math.min(8, old * Math.exp(-event.deltaY * 0.0025)))
  view.panX = zoomPan(view.panX, x, rect.width, old, next)
  view.panY = zoomPan(view.panY, y, rect.height, old, next)
  view.scale = next
  redraw()
}

function zoomPan (pan: number, cursor: number, extent: number, oldScale: number, nextScale: number): number {
  return cursor - extent * 0.5 - ((cursor - extent * 0.5 - pan) / oldScale) * nextScale
}

function handlePointerDown (event: PointerEvent, canvas: HTMLCanvasElement, view: OverlayView): void {
  view.dragging = true
  view.dragX = event.clientX
  view.dragY = event.clientY
  canvas.style.cursor = 'grabbing'
  canvas.setPointerCapture(event.pointerId)
}

function handlePointerMove (event: PointerEvent, view: OverlayView, redraw: () => void): void {
  if (!view.dragging) return
  view.panX += event.clientX - view.dragX
  view.panY += event.clientY - view.dragY
  view.dragX = event.clientX
  view.dragY = event.clientY
  redraw()
}

function handlePointerUp (canvas: HTMLCanvasElement, view: OverlayView): void {
  view.dragging = false
  canvas.style.cursor = 'grab'
}
