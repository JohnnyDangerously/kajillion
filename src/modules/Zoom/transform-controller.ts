import { ZoomAnimationController } from './animation-controller'
import { type EasingFunction } from './animation'
import { NativeZoomTransform } from './native'

interface ZoomTransformControllerOptions {
  getTransform: () => NativeZoomTransform;
  constrainTransform: (transform: NativeZoomTransform) => NativeZoomTransform;
  applyTransform: (transform: NativeZoomTransform) => void;
  notifyStart: () => void;
  notifyEnd: () => void;
}

export class ZoomTransformController {
  private readonly animation = new ZoomAnimationController()
  private readonly options: ZoomTransformControllerOptions

  public constructor (options: ZoomTransformControllerOptions) {
    this.options = options
  }

  public setTransform (
    transform: NativeZoomTransform,
    duration = 0,
    ease?: EasingFunction,
    onComplete?: () => void
  ): void {
    const target = this.options.constrainTransform(transform)
    this.cancel()
    this.options.notifyStart()
    if (duration <= 0) {
      this.options.applyTransform(target)
      this.options.notifyEnd()
      onComplete?.()
      return
    }

    this.animation.run({
      start: this.options.getTransform(),
      target,
      duration,
      ease,
      applyTransform: transform => this.options.applyTransform(transform),
      onComplete: () => {
        this.options.notifyEnd()
        onComplete?.()
      },
    })
  }

  public cancel (): void {
    this.animation.cancel()
  }
}
