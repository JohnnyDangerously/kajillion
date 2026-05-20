import { mat3 } from 'gl-matrix'

export class NativeZoomTransform {
  public readonly x: number
  public readonly y: number
  public readonly k: number

  public constructor (x = 0, y = 0, k = 1) {
    this.x = x
    this.y = y
    this.k = k
  }

  public applyX (x: number): number {
    return this.x + x * this.k
  }

  public applyY (y: number): number {
    return this.y + y * this.k
  }
}

export interface NativeZoomEvent {
  type: 'start' | 'zoom' | 'end';
  transform: NativeZoomTransform;
  sourceEvent?: Event;
}

export type ZoomCallback = (event: NativeZoomEvent) => void

export function createNativeZoomEvent (
  type: NativeZoomEvent['type'],
  transform: NativeZoomTransform,
  sourceEvent: Event | undefined
): NativeZoomEvent {
  return { type, transform, sourceEvent }
}

export function applyNativeZoomMatrix (
  transform: mat3,
  screenSize: readonly [number, number],
  zoomTransform: NativeZoomTransform
): void {
  const [w, h] = screenSize
  if (!w || !h) return
  mat3.projection(transform, w, h)
  mat3.translate(transform, transform, [zoomTransform.x, zoomTransform.y])
  mat3.scale(transform, transform, [zoomTransform.k, zoomTransform.k])
  mat3.translate(transform, transform, [w / 2, h / 2])
  mat3.scale(transform, transform, [w / 2, h / 2])
  mat3.scale(transform, transform, [1, -1])
}
