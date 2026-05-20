import { PRIMARY_POINTER_BUTTON, WHEEL_END_DELAY_MS, WHEEL_ZOOM_SPEED } from './constants'
import { NativeZoomTransform } from './native'
import { wheelDeltaToPixels } from './wheel'

interface ZoomInputControllerOptions {
  isZoomEnabled: () => boolean;
  isRunning: () => boolean;
  shouldIgnorePointerDown: () => boolean;
  cancelAnimation: () => void;
  notifyStart: (sourceEvent: Event) => void;
  notifyEnd: (sourceEvent: Event) => void;
  applyTransform: (transform: NativeZoomTransform, sourceEvent: Event) => void;
  getTransform: () => NativeZoomTransform;
  scaleAround: (anchorX: number, anchorY: number, zoomLevel: number) => NativeZoomTransform;
}

export class ZoomInputController {
  private readonly options: ZoomInputControllerOptions
  private canvas: HTMLCanvasElement | undefined
  private activePointerId: number | undefined
  private lastPointerX = 0
  private lastPointerY = 0
  private wheelEndTimeout = 0

  public constructor (options: ZoomInputControllerOptions) {
    this.options = options
  }

  public attach (canvas: HTMLCanvasElement): void {
    if (this.canvas === canvas) return
    this.detach()
    this.canvas = canvas
    canvas.addEventListener('wheel', this.handleWheel, { passive: false })
    canvas.addEventListener('pointerdown', this.handlePointerDown)
    canvas.addEventListener('pointermove', this.handlePointerMove)
    canvas.addEventListener('pointerup', this.handlePointerUp)
    canvas.addEventListener('pointercancel', this.handlePointerUp)
  }

  public isAttached (): boolean {
    return !!this.canvas
  }

  public isAttachedTo (canvas: HTMLCanvasElement): boolean {
    return this.canvas === canvas
  }

  public detach (): boolean {
    if (!this.canvas) return false
    window.clearTimeout(this.wheelEndTimeout)
    this.canvas.removeEventListener('wheel', this.handleWheel)
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown)
    this.canvas.removeEventListener('pointermove', this.handlePointerMove)
    this.canvas.removeEventListener('pointerup', this.handlePointerUp)
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp)
    this.canvas = undefined
    this.activePointerId = undefined
    return true
  }

  private handleWheel = (event: WheelEvent): void => {
    if (!this.options.isZoomEnabled()) return
    event.preventDefault()
    this.options.cancelAnimation()
    if (!this.options.isRunning()) this.options.notifyStart(event)
    window.clearTimeout(this.wheelEndTimeout)

    const delta = wheelDeltaToPixels(event)
    const nextK = this.options.getTransform().k * Math.exp(-delta * WHEEL_ZOOM_SPEED)
    const target = this.options.scaleAround(event.offsetX, event.offsetY, nextK)
    this.options.applyTransform(target, event)
    this.wheelEndTimeout = window.setTimeout(() => {
      if (this.activePointerId === undefined) this.options.notifyEnd(event)
    }, WHEEL_END_DELAY_MS)
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (!this.options.isZoomEnabled() || event.button !== PRIMARY_POINTER_BUTTON) return
    if (this.options.shouldIgnorePointerDown()) return
    this.options.cancelAnimation()
    event.preventDefault()
    this.activePointerId = event.pointerId
    this.lastPointerX = event.clientX
    this.lastPointerY = event.clientY
    this.canvas?.setPointerCapture(event.pointerId)
    this.options.notifyStart(event)
  }

  private handlePointerMove = (event: PointerEvent): void => {
    if (this.activePointerId !== event.pointerId) return
    event.preventDefault()
    const transform = this.options.getTransform()
    const dx = event.clientX - this.lastPointerX
    const dy = event.clientY - this.lastPointerY
    this.lastPointerX = event.clientX
    this.lastPointerY = event.clientY
    this.options.applyTransform(new NativeZoomTransform(
      transform.x + dx,
      transform.y + dy,
      transform.k
    ), event)
  }

  private handlePointerUp = (event: PointerEvent): void => {
    if (this.activePointerId !== event.pointerId) return
    event.preventDefault()
    this.canvas?.releasePointerCapture(event.pointerId)
    this.activePointerId = undefined
    this.options.notifyEnd(event)
  }
}
