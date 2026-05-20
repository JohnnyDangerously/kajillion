import {
  getAnimationProgress,
  type EasingFunction,
  interpolateZoomTransform,
  linearEase,
} from './animation'
import { NativeZoomTransform } from './native'

interface RunZoomAnimationOptions {
  start: NativeZoomTransform;
  target: NativeZoomTransform;
  duration: number;
  ease?: EasingFunction;
  applyTransform: (transform: NativeZoomTransform) => void;
  onComplete: () => void;
}

export class ZoomAnimationController {
  private animationFrame = 0

  public run (options: RunZoomAnimationOptions): void {
    const startTime = performance.now()
    const easing = options.ease ?? linearEase
    const tick = (now: number): void => {
      const t = getAnimationProgress(now, startTime, options.duration)
      const e = easing(t)
      options.applyTransform(interpolateZoomTransform(options.start, options.target, e))
      if (t < 1) {
        this.animationFrame = requestAnimationFrame(tick)
      } else {
        this.animationFrame = 0
        options.onComplete()
      }
    }
    this.animationFrame = requestAnimationFrame(tick)
  }

  public cancel (): void {
    if (!this.animationFrame) return
    cancelAnimationFrame(this.animationFrame)
    this.animationFrame = 0
  }
}
