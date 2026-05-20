import { Store } from '@/graph/modules/Store'
import { type GraphConfigInterface } from '@/graph/config'
import { type EasingFunction } from './animation'
import {
  convertScreenToSpacePosition,
  convertSpaceToScreenPosition,
  convertSpaceToScreenRadius,
} from './coordinates'
import { ZoomEventController } from './events'
import { ZoomInputController } from './input-controller'
import {
  applyNativeZoomMatrix,
  NativeZoomTransform,
  type ZoomCallback,
} from './native'
import { ZoomTransformController } from './transform-controller'
import { ZoomViewportController } from './viewport-controller'

export { type NativeZoomEvent, NativeZoomTransform } from './native'

export class Zoom {
  public readonly store: Store
  public readonly config: GraphConfigInterface
  public eventTransform = new NativeZoomTransform()
  public isRunning = false
  public shouldEnableSimulationDuringZoomOverride: boolean | undefined = undefined
  public onStart: ZoomCallback | undefined
  public onZoom: ZoomCallback | undefined
  public onEnd: ZoomCallback | undefined

  private readonly viewport: ZoomViewportController
  private readonly events = new ZoomEventController({
    getConfig: () => this.config,
    getTransform: () => this.eventTransform,
    setRunning: value => { this.isRunning = value },
    clearSimulationOverride: () => { this.shouldEnableSimulationDuringZoomOverride = undefined },
    getCallbacks: () => ({ onStart: this.onStart, onZoom: this.onZoom, onEnd: this.onEnd }),
  })
  private readonly transforms = new ZoomTransformController({
    getTransform: () => this.eventTransform,
    constrainTransform: transform => this.constrainTransform(transform),
    applyTransform: transform => this.applyTransform(transform),
    notifyStart: () => this.events.notifyStart(undefined),
    notifyEnd: () => this.events.notifyEnd(undefined),
  })
  private readonly input = new ZoomInputController({
    isZoomEnabled: () => this.config.enableZoom,
    isRunning: () => this.isRunning,
    shouldIgnorePointerDown: () => !!this.store.hoveredPoint && !this.store.isSpaceKeyPressed,
    cancelAnimation: () => this.cancelAnimation(),
    notifyStart: event => this.events.notifyStart(event),
    notifyEnd: event => this.events.notifyEnd(event),
    applyTransform: (transform, event) => this.applyTransform(transform, event),
    getTransform: () => this.eventTransform,
    scaleAround: (anchorX, anchorY, zoomLevel) => this.scaleAround(anchorX, anchorY, zoomLevel),
  })

  public constructor (store: Store, config: GraphConfigInterface) {
    this.store = store
    this.config = config
    this.viewport = new ZoomViewportController(store, config)
    this.updateScaleExtent()
  }

  public attach (canvas: HTMLCanvasElement): void {
    if (this.input.isAttachedTo(canvas)) return
    this.detach()
    this.input.attach(canvas)
  }

  public detach (): void {
    if (!this.input.isAttached()) return
    this.cancelAnimation()
    this.input.detach()
    this.isRunning = false
  }

  public updateScaleExtent (): void {
    this.applyTransform(this.constrainTransform(this.eventTransform))
  }

  public updateTranslateExtent (): void {
    this.viewport.updateTranslateExtent(this.eventTransform, transform => this.applyTransform(transform))
  }

  public constrainTransform (transform: NativeZoomTransform): NativeZoomTransform {
    return this.viewport.constrainTransform(transform)
  }

  public getTransform (positions: number[] | Float32Array, scale?: number, padding = 0.1): NativeZoomTransform {
    return this.viewport.getTransform(positions, this.eventTransform, scale, padding)
  }

  public getDistanceToPoint (position: [number, number]): number {
    const { x, y, k } = this.eventTransform
    const point = this.getTransform(position, k)
    const dx = x - point.x
    const dy = y - point.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  public getMiddlePointTransform (position: [number, number]): NativeZoomTransform {
    return this.viewport.getMiddlePointTransform(position, this.eventTransform)
  }

  public setZoomLevel (zoomLevel: number, duration = 0, ease?: EasingFunction, onComplete?: () => void): void {
    const [width, height] = this.store.screenSize
    const anchorX = width / 2
    const anchorY = height / 2
    const transform = this.scaleAround(anchorX, anchorY, zoomLevel)
    this.setTransform(transform, duration, ease, onComplete)
  }

  public setTransform (transform: NativeZoomTransform, duration = 0, ease?: EasingFunction, onComplete?: () => void): void {
    this.transforms.setTransform(transform, duration, ease, onComplete)
  }

  public convertScreenToSpacePosition (screenPosition: [number, number]): [number, number] {
    return convertScreenToSpacePosition(
      screenPosition,
      this.eventTransform,
      this.store.screenSize,
      this.store.adjustedSpaceSize
    )
  }

  public convertSpaceToScreenPosition (spacePosition: [number, number]): [number, number] {
    return convertSpaceToScreenPosition(
      spacePosition,
      this.eventTransform,
      this.store.scaleX.bind(this.store),
      this.store.scaleY.bind(this.store)
    )
  }

  public convertSpaceToScreenRadius (spaceRadius: number): number {
    return convertSpaceToScreenRadius(
      spaceRadius,
      this.config.scalePointsOnZoom,
      this.store.maxPointSize,
      this.eventTransform.k
    )
  }

  public zoomLevelToDistance (zoomLevel: number): number {
    return this.viewport.zoomLevelToDistance(zoomLevel)
  }

  public zoomDistanceToLevel (distance: number): number {
    return this.viewport.zoomDistanceToLevel(distance)
  }

  public getZoomDistance (): number {
    return this.zoomLevelToDistance(this.eventTransform.k)
  }

  private scaleAround (anchorX: number, anchorY: number, zoomLevel: number): NativeZoomTransform {
    return this.viewport.scaleAround(
      this.eventTransform,
      anchorX,
      anchorY,
      zoomLevel
    )
  }

  private applyTransform (transform: NativeZoomTransform, sourceEvent?: Event): void {
    this.eventTransform = this.constrainTransform(transform)
    this.updateMatrix()
    this.events.notifyZoom(sourceEvent)
  }

  private updateMatrix (): void {
    applyNativeZoomMatrix(this.store.transform, this.store.screenSize, this.eventTransform)
  }

  private cancelAnimation (): void {
    this.transforms.cancel()
  }
}
