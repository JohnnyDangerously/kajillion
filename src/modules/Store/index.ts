import { scaleLinear } from 'd3-scale'
import { mat3 } from 'gl-matrix'
import { Random } from 'random'
import { focusedPointRingOpacity, hoveredPointRingOpacity, defaultConfigValues } from '@/graph/config/defaults'
import type { GraphConfigInterface } from '@/graph/config/schema'
import { rgbToBrightness } from '@/graph/helper'
import { MAX_POINT_SIZE } from '@/graph/modules/Shared/point-constants'
import { resetUnsetRgba, setRgbFromColor, setRgbaFromColor, type RgbaColor } from './color'
import { type Hovered } from './hovered'
import { toStd140TransformMatrix, type Mat4Array } from './matrix'
import { getAdjustedSpaceSize } from './space-size'

export const ALPHA_MIN = 0.001
export type { Hovered } from './hovered'
export type { Mat4Array } from './matrix'

/**
 * Maximum number of executions to delay before performing hover detection.
 * This threshold prevents excessive hover detection calls for performance optimization.
 * The `findHoveredItem` method will skip actual detection until this count is reached.
 */
export const MAX_HOVER_DETECTION_DELAY = 4

/**
 * Minimum mouse movement threshold (in pixels) to trigger hover detection.
 * If the mouse moves less than this distance, hover detection will be skipped to save performance.
 */
export const MIN_MOUSE_MOVEMENT_THRESHOLD = 2

type Focused = { index: number }

export class Store {
  public pointsTextureSize = 0
  public linksTextureSize = 0
  public alpha = 1
  public transform = mat3.create()
  public screenSize: [number, number] = [0, 0]
  public mousePosition = [0, 0]
  public screenMousePosition = [0, 0]
  public searchArea = [[0, 0], [0, 0]]
  public isSimulationRunning = false
  public simulationProgress = 0
  public maxPointSize = MAX_POINT_SIZE
  public hoveredPoint: Hovered | undefined = undefined
  public focusedPoint: Focused | undefined = undefined
  public draggingPointIndex: number | undefined = undefined
  public hoveredLinkIndex: number | undefined = undefined
  public adjustedSpaceSize = defaultConfigValues.spaceSize
  public isSpaceKeyPressed = false
  public div: HTMLDivElement | undefined
  public webglMaxTextureSize = 16384 // Default fallback value

  public hoveredPointRingColor = [1, 1, 1, hoveredPointRingOpacity]
  public focusedPointRingColor = [1, 1, 1, focusedPointRingOpacity]
  public outlinedPointRingColor = [1, 1, 1, 1]
  public highlightedPointSet: Set<number> | undefined = undefined
  public outlinedPointSet: Set<number> | undefined = undefined
  public hoveredLinkColor = [-1, -1, -1, -1]
  // -1 means that the color is not set
  public greyoutPointColor = [-1, -1, -1, -1]
  // If backgroundColor is dark, isDarkenGreyout is true
  public isDarkenGreyout = false
  // Whether link hovering is enabled based on configured event handlers
  public isLinkHoveringEnabled = false
  public effectivePixelRatio = defaultConfigValues.pixelRatio
  private alphaTarget = 0
  private scalePointX = scaleLinear()
  private scalePointY = scaleLinear()
  private random = new Random()
  private _backgroundColor: [number, number, number, number] = [0, 0, 0, 0]

  public get backgroundColor (): [number, number, number, number] {
    return this._backgroundColor
  }

  public get transformationMatrix4x4 (): Mat4Array {
    return toStd140TransformMatrix(this.transform)
  }

  public set backgroundColor (color: [number, number, number, number]) {
    this._backgroundColor = color
    const brightness = rgbToBrightness(color[0], color[1], color[2])
    document.documentElement.style.setProperty('--cosmosgl-attribution-color', brightness > 0.65 ? 'black' : 'white')
    document.documentElement.style.setProperty('--cosmosgl-error-message-color', brightness > 0.65 ? 'black' : 'white')
    if (this.div) this.div.style.backgroundColor = `rgba(${color[0] * 255}, ${color[1] * 255}, ${color[2] * 255}, ${color[3]})`

    this.isDarkenGreyout = brightness < 0.65
  }

  public addRandomSeed (seed: number | string): void {
    this.random = this.random.clone(seed)
  }

  public getRandomFloat (min: number, max: number): number {
    return this.random.float(min, max)
  }

  /**
   * If the config parameter `spaceSize` exceeds the limits of WebGL,
   * it reduces the space size without changing the config parameter.
   * Ensures `spaceSize` is always a positive number >= 2 (required for Math.log2).
   */
  public adjustSpaceSize (configSpaceSize: number, webglMaxTextureSize: number): void {
    this.adjustedSpaceSize = getAdjustedSpaceSize(configSpaceSize, webglMaxTextureSize)
  }

  /**
   * Sets the WebGL texture size limit for use in atlas creation and other texture operations.
   */
  public setWebGLMaxTextureSize (webglMaxTextureSize: number): void {
    this.webglMaxTextureSize = webglMaxTextureSize
  }

  public updateScreenSize (width: number, height: number): void {
    const { adjustedSpaceSize } = this
    this.screenSize = [width, height]
    this.scalePointX
      .domain([0, adjustedSpaceSize])
      .range([(width - adjustedSpaceSize) / 2, (width + adjustedSpaceSize) / 2])
    this.scalePointY
      .domain([adjustedSpaceSize, 0])
      .range([(height - adjustedSpaceSize) / 2, (height + adjustedSpaceSize) / 2])
  }

  public scaleX (x: number): number {
    return this.scalePointX(x)
  }

  public scaleY (y: number): number {
    return this.scalePointY(y)
  }

  public setHoveredPointRingColor (color: string | RgbaColor): void {
    setRgbFromColor(this.hoveredPointRingColor, color)
  }

  public setFocusedPointRingColor (color: string | RgbaColor): void {
    setRgbFromColor(this.focusedPointRingColor, color)
  }

  public setOutlinedPointRingColor (color: string | RgbaColor): void {
    setRgbaFromColor(this.outlinedPointRingColor, color)
  }

  public setHighlightedPointSet (indices: number[] | undefined): void {
    this.highlightedPointSet = indices ? new Set(indices) : undefined
  }

  public setOutlinedPointSet (indices: number[] | undefined): void {
    this.outlinedPointSet = indices ? new Set(indices) : undefined
  }

  public setGreyoutPointColor (color: string | RgbaColor | undefined): void {
    if (color === undefined) {
      resetUnsetRgba(this.greyoutPointColor)
      return
    }
    setRgbaFromColor(this.greyoutPointColor, color)
  }

  public updateLinkHoveringEnabled (config: Pick<GraphConfigInterface, 'onLinkClick' | 'onLinkContextMenu' | 'onLinkMouseOver' | 'onLinkMouseOut'>): void {
    this.isLinkHoveringEnabled = !!(config.onLinkClick || config.onLinkContextMenu || config.onLinkMouseOver || config.onLinkMouseOut)
    if (!this.isLinkHoveringEnabled) {
      this.hoveredLinkIndex = undefined
    }
  }

  public setHoveredLinkColor (color?: string | RgbaColor): void {
    if (color === undefined) {
      resetUnsetRgba(this.hoveredLinkColor)
      return
    }
    setRgbaFromColor(this.hoveredLinkColor, color)
  }

  public setFocusedPoint (index?: number): void {
    if (index !== undefined) {
      this.focusedPoint = { index }
    } else this.focusedPoint = undefined
  }

  public addAlpha (decay: number): number {
    return (this.alphaTarget - this.alpha) * this.alphaDecay(decay)
  }

  private alphaDecay = (decay: number): number => 1 - Math.pow(ALPHA_MIN, 1 / decay)
}
