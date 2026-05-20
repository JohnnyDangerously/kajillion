import { clamp } from '@/graph/helper'
import { NativeZoomTransform } from './native'

export type EasingFunction = (t: number) => number

export const linearEase: EasingFunction = (t: number) => t

export function getAnimationProgress (now: number, startTime: number, duration: number): number {
  return clamp((now - startTime) / duration, 0, 1)
}

export function interpolateZoomTransform (
  start: NativeZoomTransform,
  target: NativeZoomTransform,
  amount: number
): NativeZoomTransform {
  return new NativeZoomTransform(
    start.x + (target.x - start.x) * amount,
    start.y + (target.y - start.y) * amount,
    start.k + (target.k - start.k) * amount
  )
}
