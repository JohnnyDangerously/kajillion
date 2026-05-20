import { type GraphConfigInterface } from '@/graph/config/schema'
import { Store } from '@/graph/modules/Store'
import { NativeZoomTransform } from './native'
import {
  getFiniteMaxZoomLevel,
  getMaxZoomLevel,
  getMinZoomLevel,
  scaleAround,
  zoomDistanceToLevel,
  zoomLevelToDistance,
} from './scale'
import {
  constrainTransformToViewport,
  getGraphTranslateExtent,
  getMiddlePointTransform,
  getTransformForPositions,
  getUnboundedTranslateExtent,
  type TranslateExtent,
} from './viewport'

export class ZoomViewportController {
  private translateExtent: TranslateExtent = getUnboundedTranslateExtent()
  private readonly store: Store
  private readonly config: GraphConfigInterface

  public constructor (store: Store, config: GraphConfigInterface) {
    this.store = store
    this.config = config
  }

  public updateTranslateExtent (
    currentTransform: NativeZoomTransform,
    applyTransform: (transform: NativeZoomTransform) => void
  ): void {
    if (!this.config.constrainCameraToGraph) {
      this.translateExtent = getUnboundedTranslateExtent()
      return
    }

    const translateExtent = getGraphTranslateExtent(
      this.store.screenSize,
      this.store.adjustedSpaceSize,
      this.config.cameraBoundsPadding
    )
    if (!translateExtent) return

    this.translateExtent = translateExtent
    applyTransform(this.constrainTransform(currentTransform))
  }

  public constrainTransform (transform: NativeZoomTransform): NativeZoomTransform {
    return constrainTransformToViewport(
      transform,
      this.store.screenSize,
      this.translateExtent,
      getMinZoomLevel(this.config),
      getMaxZoomLevel(this.config)
    )
  }

  public getTransform (
    positions: number[] | Float32Array,
    currentTransform: NativeZoomTransform,
    scale?: number,
    padding = 0.1
  ): NativeZoomTransform {
    const transform = getTransformForPositions(
      positions,
      this.store.screenSize,
      this.store.scaleX.bind(this.store),
      this.store.scaleY.bind(this.store),
      getMinZoomLevel(this.config),
      getMaxZoomLevel(this.config),
      scale,
      padding
    )
    return transform ? this.constrainTransform(transform) : currentTransform
  }

  public getMiddlePointTransform (
    position: [number, number],
    currentTransform: NativeZoomTransform
  ): NativeZoomTransform {
    return this.constrainTransform(getMiddlePointTransform(
      position,
      this.store.screenSize,
      currentTransform,
      this.store.scaleX.bind(this.store),
      this.store.scaleY.bind(this.store)
    ))
  }

  public scaleAround (
    currentTransform: NativeZoomTransform,
    anchorX: number,
    anchorY: number,
    zoomLevel: number
  ): NativeZoomTransform {
    return this.constrainTransform(scaleAround(
      currentTransform,
      anchorX,
      anchorY,
      zoomLevel,
      getMinZoomLevel(this.config),
      getMaxZoomLevel(this.config)
    ))
  }

  public zoomLevelToDistance (zoomLevel: number): number {
    return zoomLevelToDistance(zoomLevel, getMinZoomLevel(this.config), getFiniteMaxZoomLevel(this.config))
  }

  public zoomDistanceToLevel (distance: number): number {
    return zoomDistanceToLevel(distance, getMinZoomLevel(this.config), getFiniteMaxZoomLevel(this.config))
  }
}
