import { select, Selection } from 'd3-selection'
import 'd3-transition'
import { easeQuadIn } from 'd3-ease'
import { D3ZoomEvent } from 'd3-zoom'
import { D3DragEvent } from 'd3-drag'
import { Device, Framebuffer, luma, type RenderPass } from '@luma.gl/core'
import { webgl2Adapter } from '@luma.gl/webgl'
// webgpuAdapter is dynamically imported inside createDevice() when useWebGPU is set.
// Keeps it out of the WebGL2-only bundle (~50 KB min savings); zero cost when the
// flag is off, which is the default.

import { applyConfig, createDefaultConfig, resetConfigToDefaults, GraphConfigInterface, type GraphConfig } from '@/graph/config'
import {
  getRgbaColor,
  getMaxPointSize,
  readPixels,
  readRgba32FloatFramebufferAsync,
  extractIndicesFromPixels,
  sanitizeHtml,
} from '@/graph/helper'
import { ForceCenter } from '@/graph/modules/ForceCenter'
import { ForceGravity } from '@/graph/modules/ForceGravity'
import { ForceLink, LinkDirection } from '@/graph/modules/ForceLink'
import { ForceManyBody } from '@/graph/modules/ForceManyBody'
import { ForceMouse } from '@/graph/modules/ForceMouse'
import { Clusters } from '@/graph/modules/Clusters'
import { FPSMonitor } from '@/graph/modules/FPSMonitor'
import { GraphData } from '@/graph/modules/GraphData'
import { Lines } from '@/graph/modules/Lines'
import { Points } from '@/graph/modules/Points'
import { Store, ALPHA_MIN, MAX_HOVER_DETECTION_DELAY, MIN_MOUSE_MOVEMENT_THRESHOLD, type Hovered } from '@/graph/modules/Store'
import { Zoom } from '@/graph/modules/Zoom'
import { Drag } from '@/graph/modules/Drag'
import { createTimerQueryPool, type ITimerQueryPool, type GpuTimingSnapshot } from '@/graph/perf'
import { MsaaTarget, makeMsaaPassWrapper } from '@/graph/render/msaa-target'

// Below this alpha, force passes throttle to every-other-frame in
// runSimulationStep. 0.3 keeps the initial "spring + settle" motion at
// full fidelity (alpha decays from 1 → 0.3 covers ~70% of the visible
// motion) and only throttles during the long tail where per-frame
// displacement is sub-pixel anyway.
const SETTLE_TAIL_ALPHA_THRESHOLD = 0.3
const INTERPOLATED_FORCE_THROTTLE_POINTS = 100000
const INTERPOLATED_FORCE_THROTTLE_ALPHA = 0.82
const responsiveCameraEase = (t: number): number => {
  const x = Math.max(0, Math.min(1, t / 0.82))
  return x < 0.5 ? 2 * x * x : 1 - ((-2 * x + 2) ** 2) / 2
}

export interface FramePacingStats {
  estimatedRefreshHz: number;
  roundedRefreshHz: number;
  targetFps: number;
  rafCallbacks: number;
  renderedFrames: number;
  skippedFrames: number;
  skipRatio: number;
}

export interface DebugFrameTraceEvent {
  t: number;
  name: string;
  raf: number;
  rendered: number;
  skipped: number;
  alpha: number;
  sim: boolean;
  zoom: boolean;
  drag: boolean;
  dirty: boolean;
  dirtyFrames: number;
  eventType?: string;
  camera: { x: number; y: number; k: number };
  screen: [number, number];
  canvas?: { clientWidth: number; clientHeight: number; width: number; height: number };
  data?: Record<string, unknown>;
}

interface WebGpuPointPickerGrid {
  positions: Float32Array;
  cellSize: number;
  columns: number;
  rows: number;
  buckets: Int32Array[];
}

interface WebGpuLinkPickerGrid {
  positions: Float32Array;
  links: Float32Array;
  cellSize: number;
  columns: number;
  rows: number;
  cellOffsets: Int32Array;
  cellEntries: Int32Array;
  visitMarks: Uint32Array;
  visitToken: number;
}

export class Graph {
  /** Current graph configuration. Always fully populated with default values for any unset properties. */
  public config: GraphConfigInterface = createDefaultConfig()
  public graph = new GraphData(this.config)
  /** Promise that resolves when the graph is fully initialized and ready to use */
  public readonly ready: Promise<void>
  /** Whether the graph has completed initialization */
  public isReady = false
  private readonly deviceInitPromise: Promise<Device>
  /** Canvas element, assigned asynchronously during device initialization */
  private canvas!: HTMLCanvasElement
  private attributionDivElement: HTMLElement | undefined
  private canvasD3Selection: Selection<HTMLCanvasElement, undefined, null, undefined> | undefined
  private device: Device | undefined
  /**
   * Tracks whether this Graph instance owns the device and should destroy it on cleanup.
   * Set to `true` when Graph creates its own device, `false` when using an external device.
   * When `false`, the external device lifecycle is managed by the user.
   */
  private shouldDestroyDevice: boolean
  private requestAnimationFrameId = 0
  private isRightClickMouse = false
  // Idle-skip dirty flag: when true, next frame renders even if sim is
  // settled. Set by programmatic state mutations that need a redraw
  // (config changes, setColors, etc.). Auto-cleared after each render.
  private isRenderDirty = true
  private renderDirtyFrameCount = 1
  private isPointImpostorAutoActive = false
  private readonly debugFrameTrace: DebugFrameTraceEvent[] = []
  private readonly debugFrameTraceLimit = 900
  // Counter for settle-tail force throttling (every-other-frame skip).
  private simFrameCounter = 0

  private store = new Store()
  private points: Points | undefined
  private lines: Lines | undefined
  private forceGravity: ForceGravity | undefined
  private forceCenter: ForceCenter | undefined
  private forceManyBody: ForceManyBody | undefined
  private forceLinkIncoming: ForceLink | undefined
  private forceLinkOutgoing: ForceLink | undefined
  private forceMouse: ForceMouse | undefined
  private clusters: Clusters | undefined
  private zoomInstance = new Zoom(this.store, this.config)
  private dragInstance = new Drag(this.store, this.config)

  private fpsMonitor: FPSMonitor | undefined
  // Adaptive DPR state — last applied useDevicePixels value, and the timestamp
  // of the last frame the user was interacting. Used to avoid touching the
  // canvas context every frame and to delay the settle restore.
  private _lastAppliedDpr: number | undefined
  private _lastInteractionMs = 0
  private timerQueryPool: ITimerQueryPool | undefined
  // MSAA target for the canvas pass. Allocated on the first frame when
  // config.msaa > 1 and the device is WebGPU; resized to match canvas
  // dimensions. Released in destroy().
  private msaaTarget: MsaaTarget | undefined
  private lastPhysicsTickMs = Number.NEGATIVE_INFINITY
  private lastSimTickMs = 0
  private lastRafFrameMs = 0
  private estimatedRefreshHz = 60
  private nextRenderEligibleMs = 0
  private rafCallbackCount = 0
  private renderedFrameCount = 0
  private skippedFrameCount = 0
  private positionEpoch = 0
  private cachedWebGpuPointPositions: Float32Array | undefined
  private cachedWebGpuPointPositionsEpoch = -1
  private isWebGpuPointPositionsReadbackInFlight = false
  private isWebGpuPointPositionsReadbackQueued = false
  private lastWebGpuPointPositionsReadbackMs = 0
  private webGpuPointPickerGrid: WebGpuPointPickerGrid | undefined
  private webGpuLinkPickerGrid: WebGpuLinkPickerGrid | undefined
  private linkHoverTValues: Float32Array | undefined
  private linkHoverTValuesSegments = -1

  private currentEvent: D3ZoomEvent<HTMLCanvasElement, undefined> | D3DragEvent<HTMLCanvasElement, undefined, Hovered> | MouseEvent | undefined
  /**
   * The value of `_findHoveredItemExecutionCount` is incremented by 1 on each animation frame.
   * When the counter reaches MAX_HOVER_DETECTION_DELAY (default 4), it is reset to 0 and the `findHoveredPoint` or `findHoveredLine` method is executed.
   */
  private _findHoveredItemExecutionCount = 0
  /**
   * If the mouse is not on the Canvas, the `findHoveredPoint` or `findHoveredLine` method will not be executed.
   */
  private _isMouseOnCanvas = false
  /**
   * Last mouse position for detecting significant mouse movement
   */
  private _lastMouseX = 0
  private _lastMouseY = 0
  /**
   * Last checked mouse position for hover detection
   */
  private _lastCheckedMouseX = 0
  private _lastCheckedMouseY = 0
  /**
   * Force hover detection on next frame, bypassing mouse movement check.
   * Set when scene changes but mouse stays still (after simulation or zoom ends).
   */
  private _shouldForceHoverDetection = false
  /**
   * After setting data and render graph at a first time, the fit logic will run
   * */
  private _isFirstRenderAfterInit = true
  private _fitViewOnInitTimeoutID: number | undefined

  private isPointPositionsUpdateNeeded = false
  private isPointColorUpdateNeeded = false
  private isPointSizeUpdateNeeded = false
  private isPointShapeUpdateNeeded = false
  private isPointImageIndicesUpdateNeeded = false
  private isLinksUpdateNeeded = false
  private isLinkColorUpdateNeeded = false
  private isLinkWidthUpdateNeeded = false
  private isLinkArrowUpdateNeeded = false
  private isPointClusterUpdateNeeded = false
  private isForceManyBodyUpdateNeeded = false
  private isForceLinkUpdateNeeded = false
  private isForceCenterUpdateNeeded = false
  private isPointImageSizesUpdateNeeded = false

  private _isDestroyed = false

  /**
   * Create a new Graph instance.
   * @param div - Container element for the graph canvas.
   * @param config - Optional configuration. Unset properties use default values.
   */
  public constructor (
    div: HTMLDivElement,
    config?: GraphConfig,
    devicePromise?: Promise<Device>
  ) {
    if (config) applyConfig(this.config, config)
    this.zoomInstance.updateScaleExtent()

    if (devicePromise) {
      this.deviceInitPromise = devicePromise
      this.shouldDestroyDevice = false // External device - Graph does not own it
    } else {
      const canvas = document.createElement('canvas')
      this.deviceInitPromise = this.createDevice(canvas)
      this.shouldDestroyDevice = true // Graph created the device and owns it
    }

    const setupPromise = this.deviceInitPromise.then(device => {
      if (this._isDestroyed) {
        // Only destroy the device if Graph owns it
        if (this.shouldDestroyDevice) {
          device.destroy()
        }
        return device
      }
      this.device = device
      this.isReady = true
      const deviceCanvasContext = this.validateDevice(device)
      if (device.info?.type !== 'webgpu' && this.config.msaa !== 1) {
        console.warn('[kajillion] msaa > 1 is WebGPU-only; using msaa=1 for this device.')
        this.config.msaa = 1
      }

      // If external device was provided, sync its useDevicePixels with config.pixelRatio
      if (devicePromise) {
        this.applyEffectivePixelRatio(this.config.pixelRatio)
      } else {
        this.store.effectivePixelRatio = this.sanitizePixelRatio(this.config.pixelRatio)
      }

      this.store.div = div
      const deviceCanvas = deviceCanvasContext.canvas as HTMLCanvasElement
      // Ensure canvas is in the div
      if (deviceCanvas.parentNode !== this.store.div) {
        if (deviceCanvas.parentNode) {
          deviceCanvas.parentNode.removeChild(deviceCanvas)
        }
        this.store.div.appendChild(deviceCanvas)
      }
      this.addAttribution()
      deviceCanvas.style.width = '100%'
      deviceCanvas.style.height = '100%'
      this.canvas = deviceCanvas

      const w = this.canvas.clientWidth
      const h = this.canvas.clientHeight

      this.store.adjustSpaceSize(this.config.spaceSize, this.device.limits.maxTextureDimension2D)
      this.store.setWebGLMaxTextureSize(this.device.limits.maxTextureDimension2D)
      this.store.updateScreenSize(w, h)
      this.zoomInstance.updateTranslateExtent()

      this.canvasD3Selection = select<HTMLCanvasElement, undefined>(this.canvas)
      this.canvasD3Selection
        .on('mouseenter.cosmos', (event) => {
          this._isMouseOnCanvas = true
          this._lastMouseX = event.clientX
          this._lastMouseY = event.clientY
          this.markRenderDirty()
          this.traceDebugFrame('mouse-enter', { x: event.clientX, y: event.clientY })
        })
        .on('mousemove.cosmos', (event) => {
          this._isMouseOnCanvas = true
          this._lastMouseX = event.clientX
          this._lastMouseY = event.clientY
          this.markRenderDirty()
        })
        .on('mouseleave.cosmos', (event) => {
          this._isMouseOnCanvas = false
          this.currentEvent = event
          this.markRenderDirty()
          this.traceDebugFrame('mouse-leave', { x: event.clientX, y: event.clientY })

          // Clear point hover state and trigger callback if needed
          if (this.store.hoveredPoint !== undefined && this.config.onPointMouseOut) {
            this.config.onPointMouseOut(event)
          }

          // Clear link hover state and trigger callback if needed
          if (this.store.hoveredLinkIndex !== undefined && this.config.onLinkMouseOut) {
            this.config.onLinkMouseOut(event)
          }

          // Reset right-click flag
          this.isRightClickMouse = false

          // Clear hover states
          this.store.hoveredPoint = undefined
          this.store.hoveredLinkIndex = undefined

          // Update cursor style after clearing hover states
          this.updateCanvasCursor()
        })
      select(document)
        .on('keydown.cosmos', (event) => { if (event.code === 'Space') this.store.isSpaceKeyPressed = true })
        .on('keyup.cosmos', (event) => { if (event.code === 'Space') this.store.isSpaceKeyPressed = false })
      this.zoomInstance.behavior
        .on('start.detect', (e: D3ZoomEvent<HTMLCanvasElement, undefined>) => {
          this.currentEvent = e
          this.markRenderDirty()
          this.traceDebugFrame('zoom-start')
        })
        .on('zoom.detect', (e: D3ZoomEvent<HTMLCanvasElement, undefined>) => {
          const userDriven = !!e.sourceEvent
          if (userDriven) this.updateMousePosition(e.sourceEvent)
          this.currentEvent = e
          this.markRenderDirty()
          this.traceDebugFrame('zoom', { userDriven })
        })
        .on('end.detect', (e: D3ZoomEvent<HTMLCanvasElement, undefined>) => {
          this.currentEvent = e
          this.markRenderDirty()
          this.traceDebugFrame('zoom-end')
          // Force hover detection on next frame since zoom may have changed what's under the mouse
          this._shouldForceHoverDetection = true
        })
      this.dragInstance.behavior
        .on('start.detect', (e: D3DragEvent<HTMLCanvasElement, undefined, Hovered>) => {
          this.currentEvent = e
          this.markRenderDirty()
          this.traceDebugFrame('drag-start')
          this.updateCanvasCursor()
        })
        .on('drag.detect', (e: D3DragEvent<HTMLCanvasElement, undefined, Hovered>) => {
          if (this.dragInstance.isActive) {
            this.updateMousePosition(e)
          }
          this.currentEvent = e
          this.markRenderDirty()
          this.traceDebugFrame('drag')
        })
        .on('end.detect', (e: D3DragEvent<HTMLCanvasElement, undefined, Hovered>) => {
          this.currentEvent = e
          this.markRenderDirty()
          this.traceDebugFrame('drag-end')
          this.updateCanvasCursor()
        })
      this.canvasD3Selection
        .call(this.dragInstance.behavior)
        .call(this.zoomInstance.behavior)
        .on('click', this.onClick.bind(this))
        .on('mousemove', this.onMouseMove.bind(this))
        .on('contextmenu', this.onContextMenu.bind(this))
      if (!this.config.enableZoom || !this.config.enableDrag) this.updateZoomDragBehaviors()
      // Zoom level 1 means no zoom (100% scale). defaultConfigValues.initialZoomLevel is undefined,
      // so we fall back to 1 here as the neutral zoom level when no initial zoom is configured.
      this.setZoomLevel(this.config.initialZoomLevel ?? 1)

      this.store.maxPointSize = getMaxPointSize(device, this.store.effectivePixelRatio)

      // Initialize simulation state based on enableSimulation config
      // If simulation is disabled, start with isSimulationRunning = false
      this.store.isSimulationRunning = this.config.enableSimulation

      this.points = new Points(device, this.config, this.store, this.graph)
      this.lines = new Lines(device, this.config, this.store, this.graph, this.points)
      if (this.config.enableSimulation) {
        this.forceGravity = new ForceGravity(device, this.config, this.store, this.graph, this.points)
        this.forceCenter = new ForceCenter(device, this.config, this.store, this.graph, this.points)
        this.forceManyBody = new ForceManyBody(device, this.config, this.store, this.graph, this.points)
        this.forceLinkIncoming = new ForceLink(device, this.config, this.store, this.graph, this.points)
        this.forceLinkOutgoing = new ForceLink(device, this.config, this.store, this.graph, this.points)
        this.forceMouse = new ForceMouse(device, this.config, this.store, this.graph, this.points)
      }
      this.clusters = new Clusters(device, this.config, this.store, this.graph, this.points)

      this.store.backgroundColor = getRgbaColor(this.config.backgroundColor)
      this.store.setHoveredPointRingColor(this.config.hoveredPointRingColor)
      this.store.setFocusedPointRingColor(this.config.focusedPointRingColor)
      if (this.config.focusedPointIndex !== undefined) {
        this.store.setFocusedPoint(this.config.focusedPointIndex)
      }
      this.store.setGreyoutPointColor(this.config.pointGreyoutColor)
      this.store.setOutlinedPointRingColor(this.config.outlinedPointRingColor)
      this.store.setHighlightedPointSet(this.config.highlightedPointIndices)
      this.store.setOutlinedPointSet(this.config.outlinedPointIndices)
      this.store.setHoveredLinkColor(this.config.hoveredLinkColor)

      this.store.updateLinkHoveringEnabled(this.config)

      if (this.config.showFPSMonitor) this.fpsMonitor = new FPSMonitor(this.canvas)
      if (this.config.enableGpuTimings) this.timerQueryPool = createTimerQueryPool(device)

      if (this.config.randomSeed !== undefined) this.store.addRandomSeed(this.config.randomSeed)

      return device
    })
      .catch(error => {
        this.device = undefined
        this.isReady = false
        console.error('Device initialization failed:', error)
        throw error
      })

    this.ready = setupPromise.then(() => undefined)
  }

  /**
   * Returns the current simulation progress
   */
  public get progress (): number {
    if (this._isDestroyed) return 0
    return this.store.simulationProgress
  }

  /**
   * A value that gives information about the running simulation status.
   */
  public get isSimulationRunning (): boolean {
    if (this._isDestroyed) return false
    return this.store.isSimulationRunning
  }

  /**
   * The maximum point size.
   * This value is the maximum size of the `gl.POINTS` primitive that WebGL can render on the user's hardware.
   */
  public get maxPointSize (): number {
    if (this._isDestroyed) return 0
    return this.store.maxPointSize
  }

  /**
   * Returns a snapshot of per-pass GPU timings (in milliseconds) for the most recent frames.
   * Requires `enableGpuTimings: true` in config and `EXT_disjoint_timer_query_webgl2` support
   * on the underlying WebGL2 context (widely available in Chromium-based browsers and Safari;
   * disabled by default in Firefox on many systems).
   *
   * Returns `null` if timings are disabled or unsupported.
   *
   * @returns Map of pass label to `{ avgMs, lastMs, sampleCount }`, or `null`.
   */
  public getGpuTimings (): GpuTimingSnapshot | null {
    if (this._isDestroyed || !this.timerQueryPool) return null
    if (!this.timerQueryPool.isSupported()) return null
    return this.timerQueryPool.getSnapshot()
  }

  /**
   * Returns render-loop pacing diagnostics. Useful for distinguishing display
   * refresh limits from engine/GPU limits on high-refresh monitors.
   */
  public getFramePacingStats (): FramePacingStats {
    const total = this.renderedFrameCount + this.skippedFrameCount
    return {
      estimatedRefreshHz: this.estimatedRefreshHz,
      roundedRefreshHz: this.getRoundedRefreshHz(),
      targetFps: this.getTargetRenderFps(),
      rafCallbacks: this.rafCallbackCount,
      renderedFrames: this.renderedFrameCount,
      skippedFrames: this.skippedFrameCount,
      skipRatio: total > 0 ? this.skippedFrameCount / total : 0,
    }
  }

  public getDebugFrameTrace (): DebugFrameTraceEvent[] {
    return this.debugFrameTrace.map(event => ({
      ...event,
      camera: { ...event.camera },
      screen: [...event.screen] as [number, number],
      canvas: event.canvas ? { ...event.canvas } : undefined,
      data: event.data ? { ...event.data } : undefined,
    }))
  }

  public clearDebugFrameTrace (): void {
    this.debugFrameTrace.length = 0
  }

  public markDebugFlash (label = 'manual'): void {
    this.traceDebugFrame('flash-marker', { label })
  }

  /**
   * Clears all in-flight GPU timer queries and the rolling sample window.
   * Call this just before starting a measurement period (e.g. after a warmup
   * window has elapsed) so that subsequent `getGpuTimings()` calls reflect
   * only the work done since the reset.
   *
   * No-op when `enableGpuTimings` is false or the extension is unsupported.
   */
  public resetGpuTimings (): void {
    if (this._isDestroyed || !this.timerQueryPool) return
    this.timerQueryPool.reset()
  }

  /**
   * Apply a new configuration. Changes take effect immediately.
   *
   * **Important:** Every call fully resets the configuration to defaults first,
   * then applies the provided values on top. Properties not included in `config`
   * will revert to their default values — they are not preserved from the previous call.
   *
   * @param config - Configuration object. Only include the properties you want to set.
   */
  public setConfig (config: GraphConfig): void {
    if (this._isDestroyed) return

    if (this.ensureDevice(() => this.setConfig(config))) return
    const prevConfig = { ...this.config }
    resetConfigToDefaults(this.config)
    applyConfig(this.config, config)
    this.preserveInitOnlyFields(prevConfig)
    this.updateStateFromConfig(prevConfig)
  }

  /**
   * Partially updates the graph configuration. Only the provided properties
   * will be changed; all other properties retain their current values.
   *
   * Properties set to `undefined` will be reset to their default values.
   *
   * @param config - A partial configuration object with the properties to update.
   */
  public setConfigPartial (config: GraphConfig): void {
    if (this._isDestroyed) return

    if (this.ensureDevice(() => this.setConfigPartial(config))) return
    const prevConfig = { ...this.config }
    applyConfig(this.config, config, true)
    this.preserveInitOnlyFields(prevConfig)
    this.updateStateFromConfig(prevConfig)
  }

  /**
   * Sets the positions for the graph points.
   *
   * @param {Float32Array} pointPositions - A Float32Array representing the positions of points in the format [x1, y1, x2, y2, ..., xn, yn],
   * where `n` is the index of the point.
   * Example: `new Float32Array([1, 2, 3, 4, 5, 6])` sets the first point to (1, 2), the second point to (3, 4), and so on.
   * @param {boolean | undefined} dontRescale - For this call only, don't rescale the points.
   *   - `true`: Don't rescale.
   *   - `false` or `undefined` (default): Use the behavior defined by `config.rescalePositions`.
   */
  public setPointPositions (pointPositions: Float32Array, dontRescale?: boolean | undefined): void {
    if (this._isDestroyed) return

    if (this.ensureDevice(() => this.setPointPositions(pointPositions, dontRescale))) return
    this.graph.inputPointPositions = pointPositions
    this.points!.shouldSkipRescale = dontRescale
    this.isPointPositionsUpdateNeeded = true
    // Links related texture depends on point positions, so we need to update it
    this.isLinksUpdateNeeded = true
    // Point related textures depend on point positions length, so we need to update them
    this.isPointColorUpdateNeeded = true
    this.isPointSizeUpdateNeeded = true
    this.isPointShapeUpdateNeeded = true
    this.isPointImageIndicesUpdateNeeded = true
    this.isPointImageSizesUpdateNeeded = true
    this.isPointClusterUpdateNeeded = true
    this.isForceManyBodyUpdateNeeded = true
    this.isForceLinkUpdateNeeded = true
    this.isForceCenterUpdateNeeded = true
    this.markPointPositionsChanged(true)
  }

  /**
   * Sets the colors for the graph points.
   *
   * @param {Float32Array} pointColors - A Float32Array representing the colors of points in the format [r1, g1, b1, a1, r2, g2, b2, a2, ..., rn, gn, bn, an],
   * where each color is represented in RGBA format.
   * Example: `new Float32Array([1, 0, 0, 1, 0, 1, 0, 1])` sets the first point to red and the second point to green.
  */
  public setPointColors (pointColors: Float32Array): void {
    if (this._isDestroyed) return

    if (this.ensureDevice(() => this.setPointColors(pointColors))) return
    this.graph.inputPointColors = pointColors
    this.isPointColorUpdateNeeded = true
  }

  /**
   * Gets the current colors of the graph points.
   *
   * @returns {Float32Array} A Float32Array representing the colors of points in the format [r1, g1, b1, a1, r2, g2, b2, a2, ..., rn, gn, bn, an],
   * where each color is in RGBA format. Returns an empty Float32Array if no point colors are set.
   */
  public getPointColors (): Float32Array {
    if (this._isDestroyed) return new Float32Array()
    return this.graph.pointColors ?? new Float32Array()
  }

  /**
   * Sets the sizes for the graph points.
   *
   * @param {Float32Array} pointSizes - A Float32Array representing the sizes of points in the format [size1, size2, ..., sizen],
   * where `n` is the index of the point.
   * Example: `new Float32Array([10, 20, 30])` sets the first point to size 10, the second point to size 20, and the third point to size 30.
   */
  public setPointSizes (pointSizes: Float32Array): void {
    if (this._isDestroyed) return
    if (this.ensureDevice(() => this.setPointSizes(pointSizes))) return
    this.graph.inputPointSizes = pointSizes
    this.isPointSizeUpdateNeeded = true
  }

  /**
   * Sets the shapes for the graph points.
   *
   * @param {Float32Array} pointShapes - A Float32Array representing the shapes of points in the format [shape1, shape2, ..., shapen],
   * where `n` is the index of the point and each shape value corresponds to a PointShape enum:
   * 0 = Circle, 1 = Square, 2 = Triangle, 3 = Diamond, 4 = Pentagon, 5 = Hexagon, 6 = Star, 7 = Cross, 8 = None.
   * Example: `new Float32Array([0, 1, 2])` sets the first point to Circle, the second point to Square, and the third point to Triangle.
   * Images are rendered above shapes.
   */
  public setPointShapes (pointShapes: Float32Array): void {
    if (this._isDestroyed) return
    if (this.ensureDevice(() => this.setPointShapes(pointShapes))) return
    this.graph.inputPointShapes = pointShapes
    this.isPointShapeUpdateNeeded = true
  }

  /**
   * Sets the images for the graph points using ImageData objects.
   * Images are rendered above shapes.
   * To use images, provide image indices via setPointImageIndices().
   *
   * @param {ImageData[]} imageDataArray - Array of ImageData objects to use as point images.
   * Example: `setImageData([imageData1, imageData2, imageData3])`
   */
  public setImageData (imageDataArray: ImageData[]): void {
    if (this._isDestroyed) return
    if (this.ensureDevice(() => this.setImageData(imageDataArray))) return
    this.graph.inputImageData = imageDataArray
    this.points?.createAtlas()
  }

  /**
   * Sets which image each point should use from the images array.
   * Images are rendered above shapes.
   *
   * @param {Float32Array} imageIndices - A Float32Array representing which image each point uses in the format [index1, index2, ..., indexn],
   * where `n` is the index of the point and each value is an index into the images array provided to `setImageData`.
   * Example: `new Float32Array([0, 1, 0])` sets the first point to use image 0, second point to use image 1, third point to use image 0.
   */
  public setPointImageIndices (imageIndices: Float32Array): void {
    if (this._isDestroyed) return
    if (this.ensureDevice(() => this.setPointImageIndices(imageIndices))) return
    this.graph.inputPointImageIndices = imageIndices
    this.isPointImageIndicesUpdateNeeded = true
  }

  /**
   * Sets the sizes for the point images.
   *
   * @param {Float32Array} imageSizes - A Float32Array representing the sizes of point images in the format [size1, size2, ..., sizen],
   * where `n` is the index of the point.
   * Example: `new Float32Array([10, 20, 30])` sets the first image to size 10, the second image to size 20, and the third image to size 30.
   */
  public setPointImageSizes (imageSizes: Float32Array): void {
    if (this._isDestroyed) return
    if (this.ensureDevice(() => this.setPointImageSizes(imageSizes))) return
    this.graph.inputPointImageSizes = imageSizes
    this.isPointImageSizesUpdateNeeded = true
  }

  /**
   * Gets the current sizes of the graph points.
   *
   * @returns {Float32Array} A Float32Array representing the sizes of points in the format [size1, size2, ..., sizen],
   * where `n` is the index of the point. Returns an empty Float32Array if no point sizes are set.
   */
  public getPointSizes (): Float32Array {
    if (this._isDestroyed) return new Float32Array()
    return this.graph.pointSizes ?? new Float32Array()
  }

  /**
   * Sets the links for the graph.
   *
   * @param {Float32Array} links - A Float32Array representing the links between points
   * in the format [source1, target1, source2, target2, ..., sourcen, targetn],
   * where `source` and `target` are the indices of the points being linked.
   * Example: `new Float32Array([0, 1, 1, 2])` creates a link from point 0 to point 1 and another link from point 1 to point 2.
   */
  public setLinks (links: Float32Array): void {
    if (this._isDestroyed) return
    if (this.ensureDevice(() => this.setLinks(links))) return
    this.graph.inputLinks = links
    this.isLinksUpdateNeeded = true
    // Links related texture depends on links length, so we need to update it
    this.isLinkColorUpdateNeeded = true
    this.isLinkWidthUpdateNeeded = true
    this.isLinkArrowUpdateNeeded = true
    this.isForceLinkUpdateNeeded = true
    this.markLinksChanged()
  }

  /**
   * Sets the colors for the graph links.
   *
   * @param {Float32Array} linkColors - A Float32Array representing the colors of links in the format [r1, g1, b1, a1, r2, g2, b2, a2, ..., rn, gn, bn, an],
   * where each color is in RGBA format.
   * Example: `new Float32Array([1, 0, 0, 1, 0, 1, 0, 1])` sets the first link to red and the second link to green.
   */
  public setLinkColors (linkColors: Float32Array): void {
    if (this._isDestroyed) return
    if (this.ensureDevice(() => this.setLinkColors(linkColors))) return
    this.graph.inputLinkColors = linkColors
    this.isLinkColorUpdateNeeded = true
  }

  /**
   * Gets the current colors of the graph links.
   *
   * @returns {Float32Array} A Float32Array representing the colors of links in the format [r1, g1, b1, a1, r2, g2, b2, a2, ..., rn, gn, bn, an],
   * where each color is in RGBA format. Returns an empty Float32Array if no link colors are set.
   */
  public getLinkColors (): Float32Array {
    if (this._isDestroyed) return new Float32Array()
    return this.graph.linkColors ?? new Float32Array()
  }

  /**
   * Sets the widths for the graph links.
   *
   * @param {Float32Array} linkWidths - A Float32Array representing the widths of links in the format [width1, width2, ..., widthn],
   * where `n` is the index of the link.
   * Example: `new Float32Array([1, 2, 3])` sets the first link to width 1, the second link to width 2, and the third link to width 3.
   */
  public setLinkWidths (linkWidths: Float32Array): void {
    if (this._isDestroyed) return
    if (this.ensureDevice(() => this.setLinkWidths(linkWidths))) return
    this.graph.inputLinkWidths = linkWidths
    this.isLinkWidthUpdateNeeded = true
  }

  /**
   * Gets the current widths of the graph links.
   *
   * @returns {Float32Array} A Float32Array representing the widths of links in the format [width1, width2, ..., widthn],
   * where `n` is the index of the link. Returns an empty Float32Array if no link widths are set.
   */
  public getLinkWidths (): Float32Array {
    if (this._isDestroyed) return new Float32Array()
    return this.graph.linkWidths ?? new Float32Array()
  }

  /**
   * Sets the arrows for the graph links.
   *
   * @param {boolean[]} linkArrows - An array of booleans indicating whether each link should have an arrow,
   * in the format [arrow1, arrow2, ..., arrown], where `n` is the index of the link.
   * Example: `[true, false, true]` sets arrows on the first and third links, but not on the second link.
   */
  public setLinkArrows (linkArrows: boolean[]): void {
    if (this._isDestroyed) return
    if (this.ensureDevice(() => this.setLinkArrows(linkArrows))) return
    this.graph.linkArrowsBoolean = linkArrows
    this.isLinkArrowUpdateNeeded = true
  }

  /**
   * Sets the strength for the graph links.
   *
   * @param {Float32Array} linkStrength - A Float32Array representing the strength of each link in the format [strength1, strength2, ..., strengthn],
   * where `n` is the index of the link.
   * Example: `new Float32Array([1, 2, 3])` sets the first link to strength 1, the second link to strength 2, and the third link to strength 3.
   */
  public setLinkStrength (linkStrength: Float32Array): void {
    if (this._isDestroyed) return
    if (this.ensureDevice(() => this.setLinkStrength(linkStrength))) return
    this.graph.inputLinkStrength = linkStrength
    this.isForceLinkUpdateNeeded = true
  }

  /**
   * Sets the point clusters for the graph.
   *
   * @param {(number | undefined)[]} pointClusters - Array of cluster indices for each point in the graph.
   *   - Index: Each index corresponds to a point.
   *   - Values: Integers starting from 0; `undefined` indicates that a point does not belong to any cluster and will not be affected by cluster forces.
   * @example
   *   `[0, 1, 0, 2, undefined, 1]` maps points to clusters: point 0 and 2 to cluster 0, point 1 to cluster 1, and point 3 to cluster 2.
   * Points 4 is unclustered.
   * @note Clusters without specified positions via `setClusterPositions` will be positioned at their centermass by default.
   */
  public setPointClusters (pointClusters: (number | undefined)[]): void {
    if (this._isDestroyed) return
    if (this.ensureDevice(() => this.setPointClusters(pointClusters))) return
    this.graph.inputPointClusters = pointClusters
    this.isPointClusterUpdateNeeded = true
  }

  /**
   * Sets the positions of the point clusters for the graph.
   *
   * @param {(number | undefined)[]} clusterPositions - Array of cluster positions.
   *   - Every two elements represent the x and y coordinates for a cluster position.
   *   - `undefined` means the cluster's position is not defined and will use centermass positioning instead.
   * @example
   *   `[10, 20, 30, 40, undefined, undefined]` places the first cluster at (10, 20) and the second at (30, 40);
   * the third cluster will be positioned at its centermass automatically.
   */
  public setClusterPositions (clusterPositions: (number | undefined)[]): void {
    if (this._isDestroyed) return
    if (this.ensureDevice(() => this.setClusterPositions(clusterPositions))) return
    this.graph.inputClusterPositions = clusterPositions
    this.isPointClusterUpdateNeeded = true
  }

  /**
   * Sets the force strength coefficients for clustering points in the graph.
   *
   * This method allows you to customize the forces acting on individual points during the clustering process.
   * The force coefficients determine the strength of the forces applied to each point.
   *
   * @param {Float32Array} clusterStrength - A Float32Array of force strength coefficients for each point in the format [coeff1, coeff2, ..., coeffn],
   * where `n` is the index of the point.
   * Example: `new Float32Array([1, 0.4, 0.3])` sets the force coefficient for point 0 to 1, point 1 to 0.4, and point 2 to 0.3.
   */
  public setPointClusterStrength (clusterStrength: Float32Array): void {
    if (this._isDestroyed) return
    if (this.ensureDevice(() => this.setPointClusterStrength(clusterStrength))) return
    this.graph.inputClusterStrength = clusterStrength
    this.isPointClusterUpdateNeeded = true
  }

  /**
   * Sets which points are pinned (fixed) in position.
   *
   * Pinned points:
   * - Do not move due to physics forces (gravity, repulsion, link forces, etc.)
   * - Still participate in force calculations (other nodes are attracted to/repelled by them)
   * - Can still be dragged by the user if `enableDrag` is true
   *
   * @param {number[] | null} pinnedIndices - Array of point indices to pin. Set to `[]` or `null` to unpin all points.
   * @example
   *   // Pin points 0 and 5
   *   graph.setPinnedPoints([0, 5])
   *
   *   // Unpin all points
   *   graph.setPinnedPoints([])
   *   graph.setPinnedPoints(null)
   */
  public setPinnedPoints (pinnedIndices: number[] | null): void {
    if (this._isDestroyed) return
    if (this.ensureDevice(() => this.setPinnedPoints(pinnedIndices))) return
    this.graph.inputPinnedPoints = pinnedIndices && pinnedIndices.length > 0 ? pinnedIndices : undefined
    this.points?.updatePinnedStatus()
  }

  /**
   * Renders the graph and starts rendering.
   * Does NOT modify simulation state - use start(), stop(), pause(), unpause() to control simulation.
   *
   * @param {number} [simulationAlpha] - Optional alpha value to set.
   *   - If 0: Sets alpha to 0, simulation stops after one frame (graph becomes static).
   *   - If positive: Sets alpha to that value.
   *   - If undefined: Keeps current alpha value.
   */
  public render (simulationAlpha?: number): void {
    if (this._isDestroyed) return

    if (this.ensureDevice(() => this.render(simulationAlpha))) return
    this.graph.update()
    const { fitViewOnInit, fitViewDelay, fitViewPadding, fitViewDuration, fitViewByPointsInRect, fitViewByPointIndices, initialZoomLevel } = this.config
    if (!this.graph.pointsNumber && !this.graph.linksNumber) {
      this.stopFrames()
      select(this.canvas).style('cursor', null)
      if (this.device) {
        const clearPass = this.device.beginRenderPass({
          clearColor: this.store.backgroundColor,
          clearDepth: 1,
          clearStencil: 0,
        })
        clearPass.end()
        this.device.submit()
      }
      return
    }

    // If `initialZoomLevel` is set, we don't need to fit the view
    if (this._isFirstRenderAfterInit && fitViewOnInit && initialZoomLevel === undefined) {
      this._fitViewOnInitTimeoutID = window.setTimeout(() => {
        if (fitViewByPointIndices) this.fitViewByPointIndices(fitViewByPointIndices, fitViewDuration, fitViewPadding)
        else if (fitViewByPointsInRect) {
          this.setZoomTransformByPointPositions(
            new Float32Array(this.flatten(fitViewByPointsInRect)),
            fitViewDuration,
            undefined,
            fitViewPadding
          )
        } else this.fitView(fitViewDuration, fitViewPadding)
      }, fitViewDelay)
    }
    // Update graph and start frames
    this.update(simulationAlpha)
    // Re-detect hover on the next frame since data may have changed under a stationary mouse
    this._shouldForceHoverDetection = true
    this.startFrames()

    this._isFirstRenderAfterInit = false
  }

  /**
   * Center the view on a point and zoom in, by point index.
   * @param index The index of the point in the array of points.
   * @param duration Duration of the animation transition in milliseconds (`700` by default).
   * @param scale Scale value to zoom in or out (`3` by default).
   * @param canZoomOut Set to `false` to prevent zooming out from the point (`true` by default).
   * @param enableSimulation Whether to run the simulation during the zoom transition (`true` by default).
   */
  public zoomToPointByIndex (index: number, duration = 700, scale = 3, canZoomOut = true, enableSimulation = true): void {
    if (this._isDestroyed) return

    if (this.ensureDevice(() => this.zoomToPointByIndex(index, duration, scale, canZoomOut, enableSimulation))) return
    if (!this.device || !this.points || !this.canvasD3Selection) return
    if (this.device.info?.type === 'webgpu') {
      this.zoomToPointByIndexAsync(index, duration, scale, canZoomOut, enableSimulation).catch((error) => {
        console.warn('[kajillion] WebGPU zoomToPointByIndex failed', error)
      })
      return
    }
    const { store: { screenSize } } = this
    const positionPixels = readPixels(this.device, this.points.currentPositionFbo as Framebuffer)
    if (index === undefined) return
    const posX = positionPixels[index * 4 + 0]
    const posY = positionPixels[index * 4 + 1]
    if (posX === undefined || posY === undefined) return
    const distance = this.zoomInstance.getDistanceToPoint([posX, posY])
    const zoomLevel = canZoomOut ? scale : Math.max(this.getZoomLevel(), scale)
    if (distance < Math.min(screenSize[0], screenSize[1])) {
      this.setZoomTransformByPointPositions(new Float32Array([posX, posY]), duration, zoomLevel, undefined, enableSimulation)
    } else {
      // Override the config's `enableSimulationDuringZoom` for this programmatic zoom transition.
      this.zoomInstance.shouldEnableSimulationDuringZoomOverride = enableSimulation
      const transform = this.zoomInstance.getTransform([posX, posY], zoomLevel)
      const middle = this.zoomInstance.getMiddlePointTransform([posX, posY])
      this.canvasD3Selection
        .transition()
        .ease(easeQuadIn)
        .duration(duration / 2)
        .call(this.zoomInstance.behavior.transform, middle)
        .transition()
        .ease(responsiveCameraEase)
        .duration(duration / 2)
        .call(this.zoomInstance.behavior.transform, transform)
    }
  }

  /**
   * Zoom the view in or out to the specified zoom level.
   * @param value Zoom level
   * @param duration Duration of the zoom in/out transition.
   * @param enableSimulation Whether to run the simulation during the zoom transition (`true` by default).
   */

  public zoom (value: number, duration = 0, enableSimulation = true): void {
    if (this._isDestroyed) return
    this.setZoomLevel(value, duration, enableSimulation)
  }

  /**
   * Zoom the view in or out to the specified zoom level.
   * @param value Zoom level
   * @param duration Duration of the zoom in/out transition.
   * @param enableSimulation Whether to run the simulation during the zoom transition (`true` by default).
   */
  public setZoomLevel (value: number, duration = 0, enableSimulation = true): void {
    if (this._isDestroyed) return

    if (this.ensureDevice(() => this.setZoomLevel(value, duration, enableSimulation))) return

    if (!this.canvasD3Selection) return

    // Override the config's `enableSimulationDuringZoom` for this programmatic zoom transition.
    this.zoomInstance.shouldEnableSimulationDuringZoomOverride = enableSimulation
    if (duration === 0) {
      this.canvasD3Selection
        .call(this.zoomInstance.behavior.scaleTo, value)
    } else {
      this.canvasD3Selection
        .transition()
        .ease(responsiveCameraEase)
        .duration(duration)
        .call(this.zoomInstance.behavior.scaleTo, value)
    }
  }

  /**
   * Get zoom level.
   * @returns Zoom level value of the view.
   */
  public getZoomLevel (): number {
    if (this._isDestroyed) return 0
    return this.zoomInstance.eventTransform.k
  }

  /**
   * Get current X and Y coordinates of the points.
   * @returns Array of point positions.
   */
  public getPointPositions (): number[] {
    if (this._isDestroyed || !this.device || !this.points) return []
    if (this.graph.pointsNumber === undefined) return []
    const positions: number[] = []
    positions.length = this.graph.pointsNumber * 2
    // WebGPU has no sync pixel-readback. Return the latest async CPU snapshot
    // and kick a refresh if it is stale; fall back to uploaded positions only
    // during boot before the first snapshot resolves.
    if (this.device.info?.type === 'webgpu') {
      if (this.cachedWebGpuPointPositionsEpoch < this.positionEpoch) {
        this.requestWebGpuPointPositionsSnapshot()
      }
      const cached = this.cachedWebGpuPointPositions ?? this.graph.inputPointPositions
      if (!cached) return positions
      for (let i = 0; i < this.graph.pointsNumber; i += 1) {
        positions[i * 2] = cached[i * 2] ?? 0
        positions[i * 2 + 1] = cached[i * 2 + 1] ?? 0
      }
      return positions
    }
    const pointPositionsPixels = readPixels(this.device, this.points.currentPositionFbo as Framebuffer)
    for (let i = 0; i < this.graph.pointsNumber; i += 1) {
      const posX = pointPositionsPixels[i * 4 + 0]
      const posY = pointPositionsPixels[i * 4 + 1]
      if (posX !== undefined && posY !== undefined) {
        positions[i * 2] = posX
        positions[i * 2 + 1] = posY
      }
    }
    return positions
  }

  /**
   * Async readback of settled X/Y point positions from the GPU.
   *
   * On WebGPU this copies the live positionStorageBuffer into a MAP_READ
   * staging buffer and mapAsync's it. The cost is one buffer-to-buffer
   * copy + one GPU submit + one async map (typically 1-5 ms at n=1M on
   * M-series); not per-frame fast, but cheap enough to pre-bake a
   * settled layout or export a snapshot.
   *
   * On WebGL2 this delegates to the synchronous `getPointPositions()`
   * path that already pixel-reads from the FBO.
   *
   * Returns a flat Float32Array of `[x0, y0, x1, y1, …]` of length
   * `pointsNumber * 2`. Empty array if no points are loaded.
   */
  public async readbackPointPositions (): Promise<Float32Array> {
    if (this._isDestroyed || !this.device || !this.points) return new Float32Array(0)
    if (this.graph.pointsNumber === undefined) return new Float32Array(0)
    if (this.device.info?.type === 'webgpu') {
      const requestEpoch = this.positionEpoch
      const positions = await this.points.readbackPointPositions()
      if (!this._isDestroyed && positions.length > 0) {
        this.cacheWebGpuPointPositions(positions, requestEpoch)
      }
      return positions
    }
    // WebGL2: the synchronous getPointPositions already reads from the
    // FBO. Wrap it as an async result for API parity.
    const arr = this.getPointPositions()
    return Float32Array.from(arr)
  }

  /**
   * Get current X and Y coordinates of the clusters.
   * @returns Array of cluster positions in `[x0, y0, x1, y1, ...]` order. Do not mutate the returned array.
   */
  public getClusterPositions (): Readonly<number[]> {
    if (this._isDestroyed || !this.device || !this.clusters) return []
    if (this.graph.pointClusters === undefined || this.clusters.clusterCount === undefined) return []
    return this.clusters.getCentroidPositions()
  }

  /**
   * Center and zoom in/out the view to fit all points in the scene.
   * @param duration Duration of the center and zoom in/out animation in milliseconds (`250` by default).
   * @param padding Padding around the viewport in percentage (`0.1` by default).
   * @param enableSimulation Whether to run the simulation during the zoom transition (`true` by default).
   */
  public fitView (duration = 250, padding = 0.1, enableSimulation = true): void {
    if (this._isDestroyed) return

    if (this.ensureDevice(() => this.fitView(duration, padding, enableSimulation))) return

    if (this.device?.info?.type === 'webgpu') {
      this.fitViewAsync(duration, padding, enableSimulation).catch((error) => {
        console.warn('[kajillion] WebGPU fitView failed', error)
      })
      return
    }
    this.setZoomTransformByPointPositions(new Float32Array(this.getPointPositions()), duration, undefined, padding, enableSimulation)
  }

  /**
   * Center and zoom in/out the view to fit points by their indices in the scene.
   * @param indices Point indices to fit in the view.
   * @param duration Duration of the center and zoom in/out animation in milliseconds (`250` by default).
   * @param padding Padding around the viewport in percentage (`0.1` by default).
   * @param enableSimulation Whether to run the simulation during the zoom transition (`true` by default).
   */
  public fitViewByPointIndices (indices: number[], duration = 250, padding = 0.1, enableSimulation = true): void {
    if (this._isDestroyed) return

    if (this.ensureDevice(() => this.fitViewByPointIndices(indices, duration, padding, enableSimulation))) return
    if (this.device?.info?.type === 'webgpu') {
      this.fitViewByPointIndicesAsync(indices, duration, padding, enableSimulation).catch((error) => {
        console.warn('[kajillion] WebGPU fitViewByPointIndices failed', error)
      })
      return
    }
    const positionsArray = this.getPointPositions()
    const positions = new Float32Array(indices.length * 2)
    for (const [i, index] of indices.entries()) {
      positions[i * 2] = positionsArray[index * 2] as number
      positions[i * 2 + 1] = positionsArray[index * 2 + 1] as number
    }
    this.setZoomTransformByPointPositions(positions, duration, undefined, padding, enableSimulation)
  }

  /**
   * Center and zoom in/out the view to fit points by their positions in the scene.
   * @param positions Flat array of point coordinates as `[x0, y0, x1, y1, ...]`.
   * @param duration Duration of the center and zoom in/out animation in milliseconds (`250` by default).
   * @param padding Padding around the viewport in percentage (`0.1` by default).
   * @param enableSimulation Whether to run the simulation during the zoom transition (`true` by default).
   */
  public fitViewByPointPositions (positions: number[], duration = 250, padding = 0.1, enableSimulation = true): void {
    if (this._isDestroyed) return

    if (this.ensureDevice(() => this.fitViewByPointPositions(positions, duration, padding, enableSimulation))) return

    this.setZoomTransformByPointPositions(new Float32Array(positions), duration, undefined, padding, enableSimulation)
  }

  /**
   * Sets the zoom transform so that the given point positions fit in the viewport, with optional animation.
   *
   * @param positions Flat array of point coordinates as `[x0, y0, x1, y1, ...]`.
   * @param duration Animation duration in milliseconds. Default `250`.
   * @param scale Optional scale factor; if omitted, scale is chosen to fit the positions.
   * @param padding Padding around the viewport as a fraction (e.g. `0.1` = 10%). Default `0.1`.
   * @param enableSimulation Whether to run the simulation during the zoom transition (`true` by default).
   */
  public setZoomTransformByPointPositions (positions: Float32Array, duration = 250, scale?: number, padding = 0.1, enableSimulation = true): void {
    if (this._isDestroyed) return

    if (this.ensureDevice(() => this.setZoomTransformByPointPositions(positions, duration, scale, padding, enableSimulation))) return

    // Override the config's `enableSimulationDuringZoom` for this programmatic zoom transition.
    this.zoomInstance.shouldEnableSimulationDuringZoomOverride = enableSimulation
    this.resizeCanvas()
    const transform = this.zoomInstance.getTransform(positions, scale, padding)
    this.canvasD3Selection
      ?.transition()
      .ease(responsiveCameraEase)
      .duration(duration)
      .call(this.zoomInstance.behavior.transform, transform)
  }

  /**
   * Find point indices inside a rectangular area.
   *
   * **Important:** This method is synchronous and must only be called when the graph is ready.
   * Ensure `await graph.ready` has resolved (or use the result inside `graph.ready.then(...)`) before
   * calling. If called before initialization completes, returns an empty array.
   *
   * @param rect - Array of two corner points `[[left, top], [right, bottom]]`.
   * The coordinates should be from 0 to the width/height of the canvas.
   * @returns Array of point indices inside the rectangle.
   */
  public findPointsInRect (rect: [[number, number], [number, number]]): number[] {
    if (this._isDestroyed) return []
    if (!this.isReady || !this.device || !this.points) return []
    if (this.device.info?.type === 'webgpu') return this.findPointsInRectOnCpu(rect)

    const h = this.store.screenSize[1]
    this.store.searchArea = [[rect[0][0], (h - rect[1][1])], [rect[1][0], (h - rect[0][1])]]
    if (!this.points.findPointsInRect()) return []
    return extractIndicesFromPixels(readPixels(this.device, this.points.searchFbo as Framebuffer))
  }

  /**
   * Async version of `findPointsInRect`. On WebGPU this runs the existing GPU
   * selection mask pass and reads back the mask, avoiding CPU geometry tests.
   */
  public async findPointsInRectAsync (rect: [[number, number], [number, number]]): Promise<number[]> {
    if (this._isDestroyed) return []
    if (!this.isReady) await this.ready
    if (this._isDestroyed || !this.device || !this.points) return []
    if (this.device.info?.type !== 'webgpu') return this.findPointsInRect(rect)

    const h = this.store.screenSize[1]
    this.store.searchArea = [[rect[0][0], (h - rect[1][1])], [rect[1][0], (h - rect[0][1])]]
    if (!this.points.findPointsInRect() || !this.points.searchFbo) return []
    this.device.submit()
    const pixels = await readRgba32FloatFramebufferAsync(this.device, this.points.searchFbo)
    return extractIndicesFromPixels(pixels)
  }

  /**
   * Find point indices inside a polygon area.
   *
   * **Important:** This method is synchronous and must only be called when the graph is ready.
   * Ensure `await graph.ready` has resolved (or use the result inside `graph.ready.then(...)`) before
   * calling. If called before initialization completes, returns an empty array.
   *
   * @param polygonPath - Array of points `[[x1, y1], [x2, y2], ..., [xn, yn]]` that defines the polygon.
   * The coordinates should be from 0 to the width/height of the canvas.
   * @returns Array of point indices inside the polygon.
   */
  public findPointsInPolygon (polygonPath: [number, number][]): number[] {
    if (this._isDestroyed) return []
    if (!this.isReady || !this.device || !this.points) return []

    if (polygonPath.length < 3) {
      console.warn('Polygon path requires at least 3 points to form a polygon.')
      return []
    }
    if (this.device.info?.type === 'webgpu') return this.findPointsInPolygonOnCpu(polygonPath)

    const h = this.store.screenSize[1]
    const convertedPath = polygonPath.map(([x, y]) => [x, h - y] as [number, number])
    this.points.updatePolygonPath(convertedPath)
    if (!this.points.findPointsInPolygon()) return []
    return extractIndicesFromPixels(readPixels(this.device, this.points.searchFbo as Framebuffer))
  }

  /**
   * Async version of `findPointsInPolygon`. On WebGPU this runs the GPU
   * polygon selection mask pass and reads back the mask, avoiding CPU
   * point-in-polygon tests.
   */
  public async findPointsInPolygonAsync (polygonPath: [number, number][]): Promise<number[]> {
    if (this._isDestroyed) return []
    if (!this.isReady) await this.ready
    if (this._isDestroyed || !this.device || !this.points) return []

    if (polygonPath.length < 3) {
      console.warn('Polygon path requires at least 3 points to form a polygon.')
      return []
    }
    if (this.device.info?.type !== 'webgpu') return this.findPointsInPolygon(polygonPath)

    const h = this.store.screenSize[1]
    const convertedPath = polygonPath.map(([x, y]) => [x, h - y] as [number, number])
    this.points.updatePolygonPath(convertedPath)
    if (!this.points.findPointsInPolygon() || !this.points.searchFbo) return []
    this.device.submit()
    const pixels = await readRgba32FloatFramebufferAsync(this.device, this.points.searchFbo)
    return extractIndicesFromPixels(pixels)
  }

  /**
   * Get point indices that are neighbors of the given point(s) — connected by a link in either direction.
   * @param pointIndices A single point index or an array of point indices.
   * @returns Deduplicated array of neighboring point indices.
   */
  public getNeighboringPointIndices (pointIndices: number | number[]): number[] {
    if (this._isDestroyed) return []
    return this.graph.getNeighboringPointIndices(pointIndices)
  }

  /**
   * Get link indices where both endpoints are within the given point(s).
   * @param pointIndices A single point index or an array of point indices.
   * @returns Deduplicated array of link indices connecting points within the provided set.
   */
  public getConnectedLinkIndices (pointIndices: number | number[]): number[] {
    if (this._isDestroyed) return []
    return this.graph.getConnectedLinkIndices(pointIndices)
  }

  /**
   * Get point indices at the endpoints of the given link(s).
   * @param linkIndices A single link index or an array of link indices.
   * @returns Deduplicated array of point indices at the ends of the provided links.
   */
  public getConnectedPointIndices (linkIndices: number | number[]): number[] {
    if (this._isDestroyed) return []
    return this.graph.getConnectedPointIndices(linkIndices)
  }

  /**
   * Converts the X and Y point coordinates from the space coordinate system to the screen coordinate system.
   * @param spacePosition Array of x and y coordinates in the space coordinate system.
   * @returns Array of x and y coordinates in the screen coordinate system.
   */
  public spaceToScreenPosition (spacePosition: [number, number]): [number, number] {
    if (this._isDestroyed) return [0, 0]
    return this.zoomInstance.convertSpaceToScreenPosition(spacePosition)
  }

  /**
   * Converts the X and Y point coordinates from the screen coordinate system to the space coordinate system.
   * @param screenPosition Array of x and y coordinates in the screen coordinate system.
   * @returns Array of x and y coordinates in the space coordinate system.
   */
  public screenToSpacePosition (screenPosition: [number, number]): [number, number] {
    if (this._isDestroyed) return [0, 0]
    return this.zoomInstance.convertScreenToSpacePosition(screenPosition)
  }

  /**
   * Converts the point radius value from the space coordinate system to the screen coordinate system.
   * @param spaceRadius Radius of point in the space coordinate system.
   * @returns Radius of point in the screen coordinate system.
   */
  public spaceToScreenRadius (spaceRadius: number): number {
    if (this._isDestroyed) return 0
    return this.zoomInstance.convertSpaceToScreenRadius(spaceRadius)
  }

  /**
   * Get point radius by its index.
   * @param index Index of the point.
   * @returns Radius of the point.
   */
  public getPointRadiusByIndex (index: number): number | undefined {
    if (this._isDestroyed) return undefined
    const shapeSize = this.graph.pointSizes?.[index]
    const imageSize = this.graph.pointImageSizes?.[index]
    if (shapeSize === undefined && imageSize === undefined) return undefined
    return Math.max(shapeSize ?? 0, imageSize ?? 0)
  }

  /**
   * Track multiple point positions by their indices on each Cosmos tick.
   * @param indices Array of points indices.
   */
  public trackPointPositionsByIndices (indices: number[]): void {
    if (this._isDestroyed) return

    if (this.ensureDevice(() => this.trackPointPositionsByIndices(indices))) return
    if (!this.points) return
    this.points.trackPointsByIndices(indices)
  }

  /**
   * Get current X and Y coordinates of the tracked points.
   * Do not mutate the returned map - it may affect future calls.
   * @returns A ReadonlyMap where keys are point indices and values are their corresponding X and Y coordinates in the [number, number] format.
   * @see trackPointPositionsByIndices To set which points should be tracked
   */
  public getTrackedPointPositionsMap (): ReadonlyMap<number, [number, number]> {
    if (this._isDestroyed || !this.points) return new Map()
    return this.points.getTrackedPositionsMap()
  }

  /**
   * Get current X and Y coordinates of the tracked points as an array.
   * @returns Array of point positions in the format [x1, y1, x2, y2, ..., xn, yn] for tracked points only.
   * The positions are ordered by the tracking indices (same order as provided to trackPointPositionsByIndices).
   * Returns an empty array if no points are being tracked.
   */
  public getTrackedPointPositionsArray (): number[] {
    if (this._isDestroyed || !this.points) return []
    return this.points.getTrackedPositionsArray()
  }

  /**
   * For the points that are currently visible on the screen, get a sample of point indices with their coordinates.
   * The resulting number of points will depend on the `pointSamplingDistance` configuration property,
   * and the sampled points will be evenly distributed.
   * @returns A Map object where keys are the index of the points and values are their corresponding X and Y coordinates in the [number, number] format.
   */
  public getSampledPointPositionsMap (): Map<number, [number, number]> {
    if (this._isDestroyed || !this.points) return new Map()
    return this.points.getSampledPointPositionsMap()
  }

  /**
   * For the points that are currently visible on the screen, get a sample of point indices and positions.
   * The resulting number of points will depend on the `pointSamplingDistance` configuration property,
   * and the sampled points will be evenly distributed.
   * @returns An object containing arrays of point indices and positions.
   */
  public getSampledPoints (): { indices: number[]; positions: number[] } {
    if (this._isDestroyed || !this.points) return { indices: [], positions: [] }
    return this.points.getSampledPoints()
  }

  /**
   * For the links that are currently visible on the screen, get a sample of link indices with their midpoint coordinates and angle.
   * The resulting number of links will depend on the `linkSamplingDistance` configuration property,
   * and the sampled links will be evenly distributed (one link per grid cell, based on link midpoint in screen space).
   * Each value is [x, y, angle]: position in data space; angle in radians for screen-space rotation (0 = right, positive = clockwise, e.g. for CSS rotation).
   */
  public getSampledLinkPositionsMap (): Map<number, [number, number, number]> {
    if (this._isDestroyed || !this.lines) return new Map()
    return this.lines.getSampledLinkPositionsMap()
  }

  /**
   * For the links that are currently visible on the screen, get a sample of link indices, midpoint positions, and angles.
   * The resulting number of links will depend on the `linkSamplingDistance` configuration property,
   * and the sampled links will be evenly distributed.
   * Positions are in data space; angles are in radians for screen-space rotation (0 = right, positive = clockwise, e.g. for CSS rotation).
   */
  public getSampledLinks (): { indices: number[]; positions: number[]; angles: number[] } {
    if (this._isDestroyed || !this.lines) return { indices: [], positions: [], angles: [] }
    return this.lines.getSampledLinks()
  }

  /**
   * Gets the X-axis of rescaling function.
   *
   * This scale is automatically created when position rescaling is enabled.
   */
  public getScaleX (): ((x: number) => number) | undefined {
    if (this._isDestroyed || !this.points) return undefined
    return this.points.scaleX
  }

  /**
   * Gets the Y-axis of rescaling function.
   *
   * This scale is automatically created when position rescaling is enabled.
   */
  public getScaleY (): ((y: number) => number) | undefined {
    if (this._isDestroyed || !this.points) return undefined
    return this.points.scaleY
  }

  /**
   * Start the simulation.
   * This only controls the simulation state, not rendering.
   * @param alpha Value from 0 to 1. The higher the value, the more initial energy the simulation will get.
   */
  public start (alpha = 1): void {
    if (this._isDestroyed) return

    if (this.ensureDevice(() => this.start(alpha))) return

    if (!this.graph.pointsNumber) return

    // Always set simulation as running when start() is called
    this.store.isSimulationRunning = true
    this.store.simulationProgress = 0
    this.store.alpha = alpha
    this.lastSimTickMs = 0
    this.lastPhysicsTickMs = Number.NEGATIVE_INFINITY
    this.config.onSimulationStart?.()

    // Note: Does NOT start frames - that's handled separately
  }

  /**
   * Stop the simulation. This stops the simulation and resets its state.
   * Use start() to begin a new simulation cycle.
   */
  public stop (): void {
    if (this._isDestroyed) return
    this.store.isSimulationRunning = false
    this.store.simulationProgress = 0
    this.store.alpha = 0
    this.lastSimTickMs = 0
    this.lastPhysicsTickMs = Number.NEGATIVE_INFINITY
    this.config.onSimulationEnd?.()
  }

  /**
   * Pause the simulation. When paused, the simulation stops running
   * but preserves its current state (progress, alpha).
   * Can be resumed using the unpause method.
   */
  public pause (): void {
    if (this._isDestroyed) return
    if (this.ensureDevice(() => this.pause())) return
    this.store.isSimulationRunning = false
    this.lastSimTickMs = 0
    this.lastPhysicsTickMs = Number.NEGATIVE_INFINITY
    this.config.onSimulationPause?.()
  }

  /**
   * Unpause the simulation. This method resumes a paused
   * simulation and continues its execution.
   */
  public unpause (): void {
    if (this._isDestroyed) return
    if (this.ensureDevice(() => this.unpause())) return
    this.store.isSimulationRunning = true
    this.config.onSimulationUnpause?.()
  }

  /**
   * Run one step of the simulation manually.
   * Works even when the simulation is paused.
   */
  public step (): void {
    if (this._isDestroyed) return

    if (this.ensureDevice(() => this.step())) return

    if (!this.config.enableSimulation) return
    if (!this.store.pointsTextureSize) return

    // Run one simulation step, forcing execution regardless of isSimulationRunning
    this.runSimulationStep(true)
  }

  /**
   * Destroy this Cosmos instance.
   */
  public destroy (): void {
    if (this._isDestroyed) return
    this._isDestroyed = true
    this.isReady = false
    window.clearTimeout(this._fitViewOnInitTimeoutID)
    this.stopFrames()

    // Remove all event listeners
    if (this.canvasD3Selection) {
      this.canvasD3Selection
        .on('mouseenter.cosmos', null)
        .on('mousemove.cosmos', null)
        .on('mouseleave.cosmos', null)
        .on('click', null)
        .on('mousemove', null)
        .on('contextmenu', null)
        .on('.drag', null)
        .on('.zoom', null)
    }

    select(document)
      .on('keydown.cosmos', null)
      .on('keyup.cosmos', null)

    if (this.zoomInstance?.behavior) {
      this.zoomInstance.behavior
        .on('start.detect', null)
        .on('zoom.detect', null)
        .on('end.detect', null)
    }

    if (this.dragInstance?.behavior) {
      this.dragInstance.behavior
        .on('start.detect', null)
        .on('drag.detect', null)
        .on('end.detect', null)
    }

    this.fpsMonitor?.destroy()
    this.timerQueryPool?.destroy()

    // Destroy all module resources before destroying the device
    this.points?.destroy()
    this.lines?.destroy()
    this.clusters?.destroy()
    this.forceGravity?.destroy()
    this.forceCenter?.destroy()
    this.forceManyBody?.destroy()
    this.forceLinkIncoming?.destroy()
    this.forceLinkOutgoing?.destroy()
    this.forceMouse?.destroy()
    this.msaaTarget?.destroy()
    this.msaaTarget = undefined

    if (this.device) {
      // Only clear and destroy the device if Graph owns it
      if (this.shouldDestroyDevice) {
        // Clears the canvas after particle system is destroyed
        const clearPass = this.device.beginRenderPass({
          clearColor: this.store.backgroundColor,
          clearDepth: 1,
          clearStencil: 0,
        })
        clearPass.end()
        this.device.submit()
        this.device.destroy()
      }
    }

    // Only remove canvas if Graph owns the device (canvas was created by Graph)
    if (this.shouldDestroyDevice && this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas)
    }

    if (this.attributionDivElement && this.attributionDivElement.parentNode) {
      this.attributionDivElement.parentNode.removeChild(this.attributionDivElement)
    }

    document.getElementById('gl-bench-style')?.remove()

    this.canvasD3Selection = undefined
    this.attributionDivElement = undefined
  }

  /**
   * Applies pending data changes (positions, colors, sizes, shapes, links, forces, clusters)
   * to the graph visualization. Call this after setting data via methods like `setPointPositions`,
   * `setPointColors`, `setLinks`, etc. if you need to apply changes without calling `render()`.
   */
  public create (): void {
    if (this._isDestroyed) return
    if (this.ensureDevice(() => this.create())) return
    if (!this.points) return
    if (!this.lines) return
    if (this.isPointPositionsUpdateNeeded) this.points.updatePositions()
    if (this.isPointColorUpdateNeeded) this.points.updateColor()
    if (this.isPointSizeUpdateNeeded) this.points.updateSize()
    if (this.isPointShapeUpdateNeeded) this.points.updateShape()
    if (this.isPointImageIndicesUpdateNeeded) this.points.updateImageIndices()
    if (this.isPointImageSizesUpdateNeeded) this.points.updateImageSizes()

    if (this.isLinksUpdateNeeded) this.lines.updatePointsBuffer()
    if (this.isLinkColorUpdateNeeded) this.lines.updateColor()
    if (this.isLinkWidthUpdateNeeded) this.lines.updateWidth()
    if (this.isLinkArrowUpdateNeeded) this.lines.updateArrow()

    if (this.isForceManyBodyUpdateNeeded) this.forceManyBody?.create()
    if (this.isForceLinkUpdateNeeded) {
      this.forceLinkIncoming?.create(LinkDirection.INCOMING)
      this.forceLinkOutgoing?.create(LinkDirection.OUTGOING)
    }
    if (this.isForceCenterUpdateNeeded) this.forceCenter?.create()
    if (this.isPointClusterUpdateNeeded) this.clusters?.create()

    this.isPointPositionsUpdateNeeded = false
    this.isPointColorUpdateNeeded = false
    this.isPointSizeUpdateNeeded = false
    this.isPointShapeUpdateNeeded = false
    this.isPointImageIndicesUpdateNeeded = false
    this.isPointImageSizesUpdateNeeded = false
    this.isLinksUpdateNeeded = false
    this.isLinkColorUpdateNeeded = false
    this.isLinkWidthUpdateNeeded = false
    this.isLinkArrowUpdateNeeded = false
    this.isPointClusterUpdateNeeded = false
    this.isForceManyBodyUpdateNeeded = false
    this.isForceLinkUpdateNeeded = false
    this.isForceCenterUpdateNeeded = false
  }

  /**
   * Converts an array of tuple positions to a single array containing all coordinates sequentially
   * @param pointPositions An array of tuple positions
   * @returns A flatten array of coordinates
   */
  public flatten (pointPositions: [number, number][]): number[] {
    return pointPositions.flat()
  }

  /**
   * Converts a flat array of point positions to a tuple pairs representing coordinates
   * @param pointPositions A flattened array of coordinates
   * @returns An array of tuple positions
   */
  public pair (pointPositions: number[]): [number, number][] {
    const arr = new Array(pointPositions.length / 2) as [number, number][]
    for (let i = 0; i < pointPositions.length / 2; i++) {
      arr[i] = [pointPositions[i * 2] as number, pointPositions[i * 2 + 1] as number]
    }

    return arr
  }

  /**
   * Restores init-only fields (`enableSimulation`, `initialZoomLevel`, `randomSeed`, `attribution`)
   * to their pre-update values, preventing runtime changes via setConfig/setConfigPartial.
   */
  private preserveInitOnlyFields (prevConfig: GraphConfigInterface): void {
    this.config.enableSimulation = prevConfig.enableSimulation
    this.config.initialZoomLevel = prevConfig.initialZoomLevel
    this.config.randomSeed = prevConfig.randomSeed
    this.config.attribution = prevConfig.attribution
  }

  /**
   * Compares the previous config snapshot with the current `this.config` and
   * applies any necessary side effects (updating renderers, store, behaviors, etc.).
   */
  private updateStateFromConfig (prevConfig: GraphConfigInterface): void {
    if (prevConfig.pointDefaultColor !== this.config.pointDefaultColor) {
      this.graph.updatePointColor()
      this.points?.updateColor()
    }
    if (prevConfig.pointDefaultSize !== this.config.pointDefaultSize) {
      this.graph.updatePointSize()
      this.points?.updateSize()
    }
    if (prevConfig.pointDefaultShape !== this.config.pointDefaultShape) {
      this.graph.updatePointShape()
      this.points?.updateShape()
    }
    if (prevConfig.linkDefaultColor !== this.config.linkDefaultColor) {
      this.graph.updateLinkColor()
      this.lines?.updateColor()
    }
    if (prevConfig.linkDefaultWidth !== this.config.linkDefaultWidth) {
      this.graph.updateLinkWidth()
      this.lines?.updateWidth()
    }
    if (prevConfig.linkDefaultArrows !== this.config.linkDefaultArrows) {
      this.graph.updateArrows()
      this.lines?.updateArrow()
    }
    if (prevConfig.curvedLinkSegments !== this.config.curvedLinkSegments ||
      prevConfig.curvedLinks !== this.config.curvedLinks ||
      prevConfig.curvedLinkWeight !== this.config.curvedLinkWeight ||
      prevConfig.curvedLinkControlPointDistance !== this.config.curvedLinkControlPointDistance ||
      prevConfig.linkBundlingStrength !== this.config.linkBundlingStrength ||
      prevConfig.linkBundlingCellSize !== this.config.linkBundlingCellSize) {
      this.lines?.updateCurveLineGeometry()
      this.markLinksChanged()
    }

    if (prevConfig.backgroundColor !== this.config.backgroundColor) {
      this.store.backgroundColor = getRgbaColor(this.config.backgroundColor)
    }
    if (prevConfig.hoveredPointRingColor !== this.config.hoveredPointRingColor) {
      this.store.setHoveredPointRingColor(this.config.hoveredPointRingColor)
    }
    if (prevConfig.focusedPointRingColor !== this.config.focusedPointRingColor) {
      this.store.setFocusedPointRingColor(this.config.focusedPointRingColor)
    }
    if (prevConfig.pointGreyoutColor !== this.config.pointGreyoutColor) {
      this.store.setGreyoutPointColor(this.config.pointGreyoutColor)
    }
    if (prevConfig.hoveredLinkColor !== this.config.hoveredLinkColor) {
      this.store.setHoveredLinkColor(this.config.hoveredLinkColor)
    }
    if (prevConfig.focusedPointIndex !== this.config.focusedPointIndex) {
      this.store.setFocusedPoint(this.config.focusedPointIndex)
    }
    if (prevConfig.outlinedPointRingColor !== this.config.outlinedPointRingColor) {
      this.store.setOutlinedPointRingColor(this.config.outlinedPointRingColor)
    }
    if (prevConfig.highlightedPointIndices !== this.config.highlightedPointIndices) {
      this.store.setHighlightedPointSet(this.config.highlightedPointIndices)
    }
    if (prevConfig.outlinedPointIndices !== this.config.outlinedPointIndices) {
      this.store.setOutlinedPointSet(this.config.outlinedPointIndices)
    }
    if (prevConfig.highlightedPointIndices !== this.config.highlightedPointIndices ||
        prevConfig.outlinedPointIndices !== this.config.outlinedPointIndices) {
      this.points?.updatePointStatus()
    }
    if (prevConfig.activePointIndices !== this.config.activePointIndices) {
      this.points?.updateActivePointMask()
      this.markRenderDirty()
    }
    if (prevConfig.highlightedLinkIndices !== this.config.highlightedLinkIndices) {
      this.lines?.updateLinkStatus()
    }
    if (prevConfig.activeLinkIndices !== this.config.activeLinkIndices) {
      this.lines?.updateActiveLinkMask()
      this.markRenderDirty()
    }
    if (prevConfig.pixelRatio !== this.config.pixelRatio ||
        prevConfig.adaptivePixelRatio !== this.config.adaptivePixelRatio) {
      if (this.config.adaptivePixelRatio) {
        this._lastAppliedDpr = undefined
        this.maybeApplyAdaptiveDpr(performance.now())
      } else {
        this.applyEffectivePixelRatio(this.config.pixelRatio)
      }
    }
    if (prevConfig.spaceSize !== this.config.spaceSize) {
      this.store.adjustSpaceSize(this.config.spaceSize, this.device?.limits.maxTextureDimension2D ?? 4096)
      this.resizeCanvas(true)
      this.update(this.store.isSimulationRunning ? this.store.alpha : 0)
    }
    if (prevConfig.constrainCameraToGraph !== this.config.constrainCameraToGraph ||
        prevConfig.cameraBoundsPadding !== this.config.cameraBoundsPadding) {
      this.zoomInstance.updateTranslateExtent()
    }
    if (prevConfig.showFPSMonitor !== this.config.showFPSMonitor) {
      if (this.config.showFPSMonitor) {
        this.fpsMonitor = new FPSMonitor(this.canvas)
      } else {
        this.fpsMonitor?.destroy()
        this.fpsMonitor = undefined
      }
    }
    if (prevConfig.enableGpuTimings !== this.config.enableGpuTimings) {
      if (this.config.enableGpuTimings && this.device) {
        this.timerQueryPool = createTimerQueryPool(this.device)
      } else {
        this.timerQueryPool?.destroy()
        this.timerQueryPool = undefined
      }
    }
    if (prevConfig.enableZoom !== this.config.enableZoom || prevConfig.enableDrag !== this.config.enableDrag) {
      this.updateZoomDragBehaviors()
    }
    if (prevConfig.minZoomLevel !== this.config.minZoomLevel ||
        prevConfig.maxZoomLevel !== this.config.maxZoomLevel) {
      this.zoomInstance.updateScaleExtent()
    }

    if (prevConfig.onLinkClick !== this.config.onLinkClick ||
        prevConfig.onLinkContextMenu !== this.config.onLinkContextMenu ||
        prevConfig.onLinkMouseOver !== this.config.onLinkMouseOver ||
        prevConfig.onLinkMouseOut !== this.config.onLinkMouseOut) {
      this.store.updateLinkHoveringEnabled(this.config)
    }
  }

  /**
   * Ensures device is initialized before executing a method.
   * If device is not ready, queues the method to run after initialization.
   * @param callback - Function to execute once device is ready
   * @returns true if device was not ready and operation was queued, false if device is ready
   */
  private ensureDevice (callback: () => void): boolean {
    if (!this.isReady) {
      this.ready
        .then(() => {
          if (this._isDestroyed) return
          callback()
        })
        .catch(error => {
          console.error('Device initialization failed', error)
        })
      return true
    }
    return false
  }

  private getCurrentEventType (): string | undefined {
    const event = this.currentEvent
    if (!event) return undefined
    const maybeSource = (event as D3ZoomEvent<HTMLCanvasElement, undefined>).sourceEvent
    if (maybeSource?.type) return `${event.type}:${maybeSource.type}`
    return event.type
  }

  private traceDebugFrame (name: string, data?: Record<string, unknown>): void {
    if (!this.config.debugFrameTrace) return
    const { x, y, k } = this.zoomInstance.eventTransform
    const canvas = this.canvas
      ? {
        clientWidth: this.canvas.clientWidth,
        clientHeight: this.canvas.clientHeight,
        width: this.canvas.width,
        height: this.canvas.height,
      }
      : undefined
    this.debugFrameTrace.push({
      t: performance.now(),
      name,
      raf: this.rafCallbackCount,
      rendered: this.renderedFrameCount,
      skipped: this.skippedFrameCount,
      alpha: this.store.alpha,
      sim: this.store.isSimulationRunning,
      zoom: this.zoomInstance.isRunning,
      drag: this.dragInstance.isActive,
      dirty: this.isRenderDirty,
      dirtyFrames: this.renderDirtyFrameCount,
      eventType: this.getCurrentEventType(),
      camera: { x, y, k },
      screen: [...this.store.screenSize] as [number, number],
      canvas,
      data,
    })
    if (this.debugFrameTrace.length > this.debugFrameTraceLimit) {
      this.debugFrameTrace.splice(0, this.debugFrameTrace.length - this.debugFrameTraceLimit)
    }
  }

  private markPointPositionsChanged (invalidateKnownPickerData = false): void {
    this.positionEpoch += 1
    if (invalidateKnownPickerData) {
      this.cachedWebGpuPointPositions = undefined
      this.cachedWebGpuPointPositionsEpoch = -1
      this.webGpuPointPickerGrid = undefined
      this.webGpuLinkPickerGrid = undefined
    }
  }

  private markLinksChanged (): void {
    this.webGpuLinkPickerGrid = undefined
  }

  private markRenderDirty (frames = 3): void {
    this.isRenderDirty = true
    this.renderDirtyFrameCount = Math.max(this.renderDirtyFrameCount, frames)
  }

  private shouldRenderPointImpostors (): boolean {
    if (this.device?.info?.type !== 'webgpu') return false
    if (!this.graph.pointsNumber || this.graph.pointsNumber <= 0) return false
    if (this.config.renderLodMode === 'impostor') return true
    if (this.config.renderLodMode !== 'auto') {
      this.isPointImpostorAutoActive = false
      return false
    }
    if (this.graph.pointsNumber < this.config.impostorAutoMinPoints) {
      this.isPointImpostorAutoActive = false
      return false
    }
    const zoomLevel = this.zoomInstance.eventTransform.k
    const enterZoom = this.config.impostorAutoMaxZoom
    const exitZoom = enterZoom * 1.18
    this.isPointImpostorAutoActive = this.isPointImpostorAutoActive
      ? zoomLevel <= exitZoom
      : zoomLevel <= enterZoom
    return this.isPointImpostorAutoActive
  }

  private cacheWebGpuPointPositions (positions: Float32Array, epoch: number): void {
    this.cachedWebGpuPointPositions = positions
    this.cachedWebGpuPointPositionsEpoch = epoch
    this.lastWebGpuPointPositionsReadbackMs = performance.now()
    this.rebuildWebGpuPointPickerGrid(positions)
    this.webGpuLinkPickerGrid = undefined
  }

  private requestWebGpuPointPositionsSnapshot (force = false): void {
    if (this._isDestroyed || this.device?.info?.type !== 'webgpu' || !this.points) return
    const now = performance.now()
    if (!force && now - this.lastWebGpuPointPositionsReadbackMs < 250) return
    if (this.isWebGpuPointPositionsReadbackInFlight) {
      this.isWebGpuPointPositionsReadbackQueued = true
      return
    }
    this.isWebGpuPointPositionsReadbackInFlight = true
    const requestEpoch = this.positionEpoch
    this.points.readbackPointPositions()
      .then((positions) => {
        if (!this._isDestroyed && positions.length > 0) {
          this.cacheWebGpuPointPositions(positions, requestEpoch)
        }
      })
      .catch((error) => {
        console.warn('[kajillion] WebGPU point-position snapshot failed', error)
      })
      .finally(() => {
        this.isWebGpuPointPositionsReadbackInFlight = false
        if (this.isWebGpuPointPositionsReadbackQueued) {
          this.isWebGpuPointPositionsReadbackQueued = false
          this.requestWebGpuPointPositionsSnapshot(true)
        }
      })
  }

  private rebuildWebGpuPointPickerGrid (positions: Float32Array): void {
    const n = this.graph.pointsNumber ?? 0
    if (n === 0 || positions.length < n * 2) {
      this.webGpuPointPickerGrid = undefined
      return
    }
    const spaceSize = this.store.adjustedSpaceSize || this.config.spaceSize || 4096
    const cellSize = Math.max(32, spaceSize / 128)
    const columns = Math.max(1, Math.ceil(spaceSize / cellSize))
    const rows = columns
    const bucketArrays: number[][] = Array.from({ length: columns * rows }, () => [])
    for (let i = 0; i < n; i += 1) {
      const x = positions[i * 2] ?? NaN
      const y = positions[i * 2 + 1] ?? NaN
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      const cx = Math.min(columns - 1, Math.max(0, Math.floor(x / cellSize)))
      const cy = Math.min(rows - 1, Math.max(0, Math.floor(y / cellSize)))
      bucketArrays[cy * columns + cx]?.push(i)
    }
    this.webGpuPointPickerGrid = {
      positions,
      cellSize,
      columns,
      rows,
      buckets: bucketArrays.map(bucket => Int32Array.from(bucket)),
    }
  }

  private rebuildWebGpuLinkPickerGrid (positions: Float32Array): void {
    const links = this.graph.links
    const linksNumber = this.graph.linksNumber ?? 0
    const pointsNumber = this.graph.pointsNumber ?? 0
    if (!links || linksNumber === 0 || pointsNumber === 0 || positions.length < pointsNumber * 2) {
      this.webGpuLinkPickerGrid = undefined
      return
    }

    const spaceSize = this.store.adjustedSpaceSize || this.config.spaceSize || 4096
    const cellSize = Math.max(64, spaceSize / 64)
    const columns = Math.max(1, Math.ceil(spaceSize / cellSize))
    const rows = Math.max(1, Math.ceil(spaceSize / cellSize))
    const cellCount = columns * rows
    const counts = new Int32Array(cellCount)
    const clampCellX = (value: number): number => Math.min(columns - 1, Math.max(0, Math.floor(value / cellSize)))
    const clampCellY = (value: number): number => Math.min(rows - 1, Math.max(0, Math.floor(value / cellSize)))
    const visitLinkCells = (sx: number, sy: number, tx: number, ty: number, visitor: (cell: number) => void): void => {
      const startCx = clampCellX(sx)
      const startCy = clampCellY(sy)
      const endCx = clampCellX(tx)
      const endCy = clampCellY(ty)
      const steps = Math.max(1, Math.abs(endCx - startCx), Math.abs(endCy - startCy))
      let previousCell = -1
      for (let step = 0; step <= steps; step += 1) {
        const t = step / steps
        const cx = clampCellX(sx + (tx - sx) * t)
        const cy = clampCellY(sy + (ty - sy) * t)
        const cell = cy * columns + cx
        if (cell === previousCell) continue
        visitor(cell)
        previousCell = cell
      }
    }

    for (let i = 0; i < linksNumber; i += 1) {
      const source = links[i * 2]
      const target = links[i * 2 + 1]
      if (source === undefined || target === undefined) continue
      const sx = positions[source * 2]
      const sy = positions[source * 2 + 1]
      const tx = positions[target * 2]
      const ty = positions[target * 2 + 1]
      if (sx === undefined || sy === undefined || tx === undefined || ty === undefined) continue
      if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(tx) || !Number.isFinite(ty)) continue
      this.visitLinkHoverPathSegments(sx, sy, tx, ty, i, (ax, ay, bx, by) => {
        visitLinkCells(ax, ay, bx, by, (cell) => { counts[cell] = (counts[cell] ?? 0) + 1 })
      })
    }

    const cellOffsets = new Int32Array(cellCount + 1)
    let totalEntries = 0
    for (let cell = 0; cell < cellCount; cell += 1) {
      cellOffsets[cell] = totalEntries
      totalEntries += counts[cell] ?? 0
    }
    cellOffsets[cellCount] = totalEntries

    const cellEntries = new Int32Array(totalEntries)
    const cursors = new Int32Array(cellOffsets)
    for (let i = 0; i < linksNumber; i += 1) {
      const source = links[i * 2]
      const target = links[i * 2 + 1]
      if (source === undefined || target === undefined) continue
      const sx = positions[source * 2]
      const sy = positions[source * 2 + 1]
      const tx = positions[target * 2]
      const ty = positions[target * 2 + 1]
      if (sx === undefined || sy === undefined || tx === undefined || ty === undefined) continue
      if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(tx) || !Number.isFinite(ty)) continue
      this.visitLinkHoverPathSegments(sx, sy, tx, ty, i, (ax, ay, bx, by) => {
        visitLinkCells(ax, ay, bx, by, (cell) => {
          const offset = cursors[cell] ?? 0
          cellEntries[offset] = i
          cursors[cell] = offset + 1
        })
      })
    }

    this.webGpuLinkPickerGrid = {
      positions,
      links,
      cellSize,
      columns,
      rows,
      cellOffsets,
      cellEntries,
      visitMarks: new Uint32Array(linksNumber),
      visitToken: 1,
    }
  }

  private getLinkHoverSegmentCount (): number {
    return this.config.curvedLinks || this.config.linkBundlingStrength > 0
      ? Math.max(1, Math.ceil(this.config.curvedLinkSegments))
      : 1
  }

  private getLinkHoverTValues (): Float32Array {
    const segments = this.getLinkHoverSegmentCount()
    if (this.linkHoverTValues && this.linkHoverTValuesSegments === segments) {
      return this.linkHoverTValues
    }
    const values = new Float32Array(segments + 1)
    for (let i = 0; i < segments; i += 1) {
      const d = -0.5 + i / segments
      const u = d * 2
      const signedPow = u < 0 ? -(u * u) : u * u
      values[i] = (signedPow + 1) / 2
    }
    values[segments] = 1
    this.linkHoverTValues = values
    this.linkHoverTValuesSegments = segments
    return values
  }

  private hash11 (value: number): number {
    const x = Math.fround(Math.sin(Math.fround(value * 12.9898)) * 43758.5453)
    return Math.fround(x - Math.floor(x))
  }

  private visitLinkHoverPathSegments (
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    linkIndex: number,
    visitor: (ax: number, ay: number, bx: number, by: number) => void
  ): void {
    const tValues = this.getLinkHoverTValues()
    const dx = tx - sx
    const dy = ty - sy
    const linkDist = Math.sqrt(dx * dx + dy * dy)
    const invLinkDist = linkDist > 1e-6 ? 1 / linkDist : 0
    const yBasisX = -dy * invLinkDist
    const yBasisY = dx * invLinkDist
    const isCurved = this.config.curvedLinks
    const useBundling = !isCurved && this.config.linkBundlingStrength > 0 && linkDist > 1e-6
    const controlX = (sx + tx) * 0.5 + yBasisX * linkDist * this.config.curvedLinkControlPointDistance
    const controlY = (sy + ty) * 0.5 + yBasisY * linkDist * this.config.curvedLinkControlPointDistance
    const curvedWeight = this.config.curvedLinkWeight
    const bundleCellSize = Math.max(64, this.config.linkBundlingCellSize)
    const midX = (sx + tx) * 0.5
    const midY = (sy + ty) * 0.5
    const laneCellX = (Math.floor(midX / bundleCellSize) + 0.5) * bundleCellSize
    const laneCellY = (Math.floor(midY / bundleCellSize) + 0.5) * bundleCellSize
    const xDirX = dx * invLinkDist
    const xDirY = dy * invLinkDist
    const laneProjection = (midX - laneCellX) * xDirX + (midY - laneCellY) * xDirY
    const laneTargetX = laneCellX + xDirX * laneProjection
    const laneTargetY = laneCellY + xDirY * laneProjection
    let displacementX = laneTargetX - midX
    let displacementY = laneTargetY - midY
    const displacementLen = Math.sqrt(displacementX * displacementX + displacementY * displacementY)
    const maxNudge = Math.min(bundleCellSize * 0.36, linkDist * 0.18)
    if (displacementLen > maxNudge) {
      const displacementScale = maxNudge / Math.max(displacementLen, 1e-6)
      displacementX *= displacementScale
      displacementY *= displacementScale
    }
    const strand = (this.hash11(linkIndex + Math.floor(midX / bundleCellSize) * 17 + Math.floor(midY / bundleCellSize) * 131) - 0.5) *
      Math.min(bundleCellSize * 0.025, linkDist * 0.012)

    let previousX = sx
    let previousY = sy
    for (let segment = 1; segment < tValues.length; segment += 1) {
      const t = tValues[segment] ?? 1
      let currentX: number
      let currentY: number
      if (isCurved) {
        const oneMinusT = 1 - t
        const oneMinusTSq = oneMinusT * oneMinusT
        const tSq = t * t
        const weightedT = 2 * oneMinusT * t * curvedWeight
        const divisor = oneMinusTSq + weightedT + tSq
        currentX = (oneMinusTSq * sx + weightedT * controlX + tSq * tx) / divisor
        currentY = (oneMinusTSq * sy + weightedT * controlY + tSq * ty) / divisor
      } else {
        currentX = sx + dx * t
        currentY = sy + dy * t
        if (useBundling) {
          const envelope = Math.pow(Math.max(0, Math.sin(Math.PI * Math.max(0, Math.min(1, t)))), 1.35)
          currentX += (displacementX * this.config.linkBundlingStrength + yBasisX * strand) * envelope
          currentY += (displacementY * this.config.linkBundlingStrength + yBasisY * strand) * envelope
        }
      }
      visitor(previousX, previousY, currentX, currentY)
      previousX = currentX
      previousY = currentY
    }
  }

  private distanceToLinkHoverPathScreenSquared (
    px: number,
    py: number,
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    linkIndex: number,
    transformX: number,
    transformY: number,
    k: number,
    offsetX: number,
    offsetY: number,
    spaceSize: number
  ): number {
    let bestDistanceSq = Infinity
    this.visitLinkHoverPathSegments(sx, sy, tx, ty, linkIndex, (ax, ay, bx, by) => {
      const x1 = transformX + (offsetX + ax) * k
      const y1 = transformY + (offsetY + spaceSize - ay) * k
      const x2 = transformX + (offsetX + bx) * k
      const y2 = transformY + (offsetY + spaceSize - by) * k
      const distanceSq = this.distanceToScreenSegmentSquared(px, py, x1, y1, x2, y2)
      if (distanceSq < bestDistanceSq) bestDistanceSq = distanceSq
    })
    return bestDistanceSq
  }

  private async fitViewAsync (duration = 250, padding = 0.1, enableSimulation = true): Promise<void> {
    try {
      const positions = await this.readbackPointPositions()
      if (this._isDestroyed || positions.length === 0) return
      this.setZoomTransformByPointPositions(positions, duration, undefined, padding, enableSimulation)
    } catch (error) {
      console.warn('[kajillion] WebGPU fitView readback failed', error)
    }
  }

  private async fitViewByPointIndicesAsync (indices: number[], duration = 250, padding = 0.1, enableSimulation = true): Promise<void> {
    try {
      const positionsArray = await this.readbackPointPositions()
      if (this._isDestroyed || positionsArray.length === 0) return
      const positions = new Float32Array(indices.length * 2)
      for (const [i, index] of indices.entries()) {
        positions[i * 2] = positionsArray[index * 2] ?? 0
        positions[i * 2 + 1] = positionsArray[index * 2 + 1] ?? 0
      }
      this.setZoomTransformByPointPositions(positions, duration, undefined, padding, enableSimulation)
    } catch (error) {
      console.warn('[kajillion] WebGPU fitViewByPointIndices readback failed', error)
    }
  }

  private async zoomToPointByIndexAsync (index: number, duration = 700, scale = 3, canZoomOut = true, enableSimulation = true): Promise<void> {
    try {
      if (!this.canvasD3Selection) return
      const positions = await this.readbackPointPositions()
      if (this._isDestroyed || positions.length === 0) return
      const posX = positions[index * 2]
      const posY = positions[index * 2 + 1]
      if (posX === undefined || posY === undefined) return
      const { store: { screenSize } } = this
      const distance = this.zoomInstance.getDistanceToPoint([posX, posY])
      const zoomLevel = canZoomOut ? scale : Math.max(this.getZoomLevel(), scale)
      if (distance < Math.min(screenSize[0], screenSize[1])) {
        this.setZoomTransformByPointPositions(new Float32Array([posX, posY]), duration, zoomLevel, undefined, enableSimulation)
      } else {
        this.zoomInstance.shouldEnableSimulationDuringZoomOverride = enableSimulation
        const transform = this.zoomInstance.getTransform([posX, posY], zoomLevel)
        const middle = this.zoomInstance.getMiddlePointTransform([posX, posY])
        this.canvasD3Selection
          .transition()
          .ease(easeQuadIn)
          .duration(duration / 2)
          .call(this.zoomInstance.behavior.transform, middle)
          .transition()
          .ease(responsiveCameraEase)
          .duration(duration / 2)
          .call(this.zoomInstance.behavior.transform, transform)
      }
    } catch (error) {
      console.warn('[kajillion] WebGPU zoomToPointByIndex readback failed', error)
    }
  }

  private getBestKnownWebGpuPointPositions (): Float32Array | undefined {
    if (this.cachedWebGpuPointPositionsEpoch < this.positionEpoch) {
      this.requestWebGpuPointPositionsSnapshot()
    }
    return this.cachedWebGpuPointPositions ?? this.graph.inputPointPositions
  }

  private findPointsInRectOnCpu (rect: [[number, number], [number, number]]): number[] {
    const positions = this.getBestKnownWebGpuPointPositions()
    const n = this.graph.pointsNumber ?? 0
    if (!positions || n === 0) return []
    const minX = Math.min(rect[0][0], rect[1][0])
    const maxX = Math.max(rect[0][0], rect[1][0])
    const minY = Math.min(rect[0][1], rect[1][1])
    const maxY = Math.max(rect[0][1], rect[1][1])
    const result: number[] = []
    for (let i = 0; i < n; i += 1) {
      const x = positions[i * 2]
      const y = positions[i * 2 + 1]
      if (x === undefined || y === undefined) continue
      const [screenX, screenY] = this.zoomInstance.convertSpaceToScreenPosition([x, y])
      if (screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY) {
        result.push(i)
      }
    }
    return result
  }

  private findPointsInPolygonOnCpu (polygonPath: [number, number][]): number[] {
    const positions = this.getBestKnownWebGpuPointPositions()
    const n = this.graph.pointsNumber ?? 0
    if (!positions || n === 0) return []
    const result: number[] = []
    for (let i = 0; i < n; i += 1) {
      const x = positions[i * 2]
      const y = positions[i * 2 + 1]
      if (x === undefined || y === undefined) continue
      const screenPosition = this.zoomInstance.convertSpaceToScreenPosition([x, y])
      if (this.isScreenPointInPolygon(screenPosition, polygonPath)) {
        result.push(i)
      }
    }
    return result
  }

  private isScreenPointInPolygon (point: [number, number], polygon: [number, number][]): boolean {
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const xi = polygon[i]?.[0] ?? 0
      const yi = polygon[i]?.[1] ?? 0
      const xj = polygon[j]?.[0] ?? 0
      const yj = polygon[j]?.[1] ?? 0
      const intersects = ((yi > point[1]) !== (yj > point[1])) &&
        point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || Number.EPSILON) + xi
      if (intersects) inside = !inside
    }
    return inside
  }

  /**
   * Validates that a device has the required HTMLCanvasElement canvas context.
   * Cosmos requires an HTMLCanvasElement canvas context and does not support
   * OffscreenCanvas or compute-only devices.
   * @param device - The device to validate
   * @returns The validated canvas context (guaranteed to be non-null and HTMLCanvasElement type)
   * @throws Error if the device does not meet Cosmos requirements
   */
  private validateDevice (device: Device): NonNullable<Device['canvasContext']> {
    const deviceCanvasContext = device.canvasContext
    // Cosmos requires an HTMLCanvasElement canvas context.
    // OffscreenCanvas and compute-only devices are not supported.
    if (deviceCanvasContext === null || deviceCanvasContext.type === 'offscreen-canvas') {
      throw new Error('Device must have an HTMLCanvasElement canvas context. OffscreenCanvas and compute-only devices are not supported.')
    }
    return deviceCanvasContext
  }

  /**
   * Internal device creation method
   * Graph class decides what device to create with sensible defaults
   */
  private async createDevice (
    canvas: HTMLCanvasElement
  ): Promise<Device> {
    // Truthy check (not `=== true`) so consumers parsing config from URL query strings
    // (where the value is the string 'true') get the expected behavior. Warn on values
    // that look intentional but aren't booleans so misconfig is visible.
    const useWebGPURaw = this.config.useWebGPU as unknown
    const useWebGPU = useWebGPURaw === true || useWebGPURaw === 'true' || useWebGPURaw === 1
    if (useWebGPURaw !== undefined && useWebGPURaw !== false && useWebGPURaw !== true) {
      console.warn(
        `[kajillion] config.useWebGPU should be a boolean; got ${typeof useWebGPURaw}: ${String(useWebGPURaw)}.` +
        ` Interpreted as ${useWebGPU}.`
      )
    }
    try {
      // Dynamic import keeps the WebGPU adapter out of the default WebGL2 bundle.
      const adapters = useWebGPU
        ? [(await import('@luma.gl/webgpu')).webgpuAdapter]
        : [webgl2Adapter]
      return await luma.createDevice({
        type: useWebGPU ? 'webgpu' : 'webgl',
        adapters,
        createCanvasContext: {
          canvas,
          useDevicePixels: this.sanitizePixelRatio(this.config.pixelRatio),
          autoResize: true,
          width: undefined,
          height: undefined,
        },
      })
    } catch (e) {
      if (useWebGPU) {
        // Improve the error so users know why a working WebGL2 setup just stopped
        // working after they flipped the flag. `cause` chained manually for
        // compatibility with the project's lib target.
        const wrapped = new Error(
          'kajillion: WebGPU device requested via config.useWebGPU but creation failed. ' +
          'Browser may not support WebGPU (Firefox: enable dom.webgpu.enabled; Safari: ' +
          'requires 26+ on iOS). Set useWebGPU: false to use the WebGL2 path. ' +
          `Underlying error: ${(e as Error).message}`
        )
        ;(wrapped as Error & { cause?: unknown }).cause = e
        throw wrapped
      }
      throw e
    }
  }

  /**
  * Updates and recreates the graph visualization based on pending changes.
  *
  * @param simulationAlpha - Optional alpha value to set. If not provided, keeps current alpha.
  */
  private update (simulationAlpha = this.store.alpha): void {
    const { graph } = this
    this.store.pointsTextureSize = Math.ceil(Math.sqrt(graph.pointsNumber ?? 0))
    this.store.linksTextureSize = Math.ceil(Math.sqrt((graph.linksNumber ?? 0) * 2))
    this.create()
    this.initPrograms()
    this.store.alpha = simulationAlpha
  }

  /**
   * Runs one step of the simulation (forces, position updates, alpha decay).
   * This is the core simulation logic that can be called by step() or during rendering.
   *
   * @param forceExecution - Controls whether to run the simulation step when paused.
   *   - If true: Always runs the simulation step, even when isSimulationRunning is false.
   *     Used by step() to allow manual stepping while the simulation is paused.
   *   - If false: Only runs if isSimulationRunning is true. Used during rendering
   *     to respect pause/unpause state.
   */
  private runSimulationStep (forceExecution = false): void {
    const { config: { simulationGravity, simulationCenter, enableSimulation }, store: { isSimulationRunning } } = this

    if (!enableSimulation) return

    // Right-click repulsion (runs regardless of isSimulationRunning)
    if (this.isRightClickMouse && this.config.enableRightClickRepulsion) {
      this.timerQueryPool?.begin('force.mouse')
      this.points?.swapFbo()
      this.forceMouse?.run()
      this.points?.updatePosition()
      this.timerQueryPool?.end()
    }

    // Main simulation forces gate:
    // If forceExecution is true (from step()), always run.
    // Otherwise, respect isSimulationRunning and zoom state.
    const enableSimulationDuringZoom = this.zoomInstance.shouldEnableSimulationDuringZoomOverride ?? this.config.enableSimulationDuringZoom
    let shouldRunSimulation = forceExecution ||
      (isSimulationRunning && !(this.zoomInstance.isRunning && !enableSimulationDuringZoom))

    // Force-pass throttle: skipped frames intentionally do not replay velocity
    // because re-integrating stale force output made dense layouts shimmer
    // after refresh. WebGPU draw shaders interpolate previous/current render
    // positions for dense graphs, so render cadence stays smooth while the
    // expensive Barnes-Hut rebuild runs less often.
    //
    // Disabled by `step()` (forceExecution=true) so manual stepping is
    // always exact.
    const pointCount = this.graph.pointsNumber ?? 0
    const forceThrottleAlpha = pointCount >= INTERPOLATED_FORCE_THROTTLE_POINTS
      ? INTERPOLATED_FORCE_THROTTLE_ALPHA
      : SETTLE_TAIL_ALPHA_THRESHOLD
    const forceThrottleStride = 2
    if (!forceExecution && shouldRunSimulation && this.store.alpha < forceThrottleAlpha) {
      this.simFrameCounter = (this.simFrameCounter + 1) | 0
      if ((this.simFrameCounter % forceThrottleStride) !== 0) {
        shouldRunSimulation = false
      }
    }

    // Swap-before-write: every GPU position write is preceded by swapFbo(). The swap makes
    // `previous` point to the freshest data so updatePosition() reads it
    // and writes the new result into `current`. After each swap+write pair
    // `current` holds the latest positions — the draw pass, hover detection,
    // trackPoints and the next frame all read from `current`.
    if (shouldRunSimulation) {
      if (simulationGravity) {
        this.timerQueryPool?.begin('force.gravity')
        this.points?.swapFbo()
        this.forceGravity?.run()
        this.points?.updatePosition()
        this.timerQueryPool?.end()
      }

      if (simulationCenter) {
        this.timerQueryPool?.begin('force.center')
        this.points?.swapFbo()
        this.forceCenter?.run()
        this.points?.updatePosition()
        this.timerQueryPool?.end()
      }

      this.points?.swapFbo()
      this.timerQueryPool?.begin('force.quadtree.build')
      const quadtreeReady = this.forceManyBody?.runQuadtreeBuild() ?? false
      this.timerQueryPool?.end()
      this.timerQueryPool?.begin('force.repulsion')
      if (quadtreeReady) this.forceManyBody?.runForceSample()
      this.points?.updatePosition()
      this.timerQueryPool?.end()

      if (this.store.linksTextureSize) {
        this.timerQueryPool?.begin('force.link.incoming')
        this.points?.swapFbo()
        this.forceLinkIncoming?.run()
        this.points?.updatePosition()
        this.timerQueryPool?.end()
        this.timerQueryPool?.begin('force.link.outgoing')
        this.points?.swapFbo()
        this.forceLinkOutgoing?.run()
        this.points?.updatePosition()
        this.timerQueryPool?.end()
      }

      if (this.graph.pointClusters || this.graph.clusterPositions) {
        this.timerQueryPool?.begin('force.cluster')
        this.points?.swapFbo()
        this.clusters?.run()
        this.points?.updatePosition()
        this.timerQueryPool?.end()
      }

      // Time-based alpha decay: scale by actual frame dt so settle time in wall-clock
      // seconds is FPS-invariant. Reference rate is 60 Hz (16.67 ms).
      // When the page is hidden / has been backgrounded, dt can be huge (seconds).
      // We treat that as a "skip this tick" rather than apply a 10x catch-up, because
      // the catch-up causes premature end() during background tabs.
      const tickNowMs = performance.now()
      let dtScale = 1.0
      if (this.lastSimTickMs > 0) {
        const dt = tickNowMs - this.lastSimTickMs
        if (typeof document !== 'undefined' && document.hidden) {
          // Tab not visible — don't progress alpha while the user isn't looking.
          this.lastSimTickMs = tickNowMs
        } else if (!Number.isFinite(dt) || dt > 1000) {
          // Frame >1s late (e.g. system pause) — refresh tick time but skip decay.
          this.lastSimTickMs = tickNowMs
          dtScale = 0
        } else {
          dtScale = Math.min(10, Math.max(0.1, dt / (1000 / 60)))
          this.lastSimTickMs = tickNowMs
        }
      } else {
        this.lastSimTickMs = tickNowMs
      }
      if (dtScale > 0) {
        this.store.alpha += this.store.addAlpha(this.config.simulationDecay) * dtScale
      }
      if (this.isRightClickMouse && this.config.enableRightClickRepulsion) {
        // Right-click overrides decay this tick — pin alpha back to the kick floor.
        this.store.alpha = Math.max(this.store.alpha, 0.1)
      }
      // Clamp threshold to [ALPHA_MIN, 1]; NaN-safe via Number.isFinite check
      const rawThreshold = this.config.alphaStopThreshold
      const stopThreshold = Number.isFinite(rawThreshold)
        ? Math.min(1, Math.max(ALPHA_MIN, rawThreshold))
        : ALPHA_MIN
      this.store.simulationProgress = Math.sqrt(Math.min(1, stopThreshold / Math.max(this.store.alpha, ALPHA_MIN)))

      this.config.onSimulationTick?.(
        this.store.alpha,
        this.store.hoveredPoint?.index,
        this.store.hoveredPoint?.position
      )
      this.markPointPositionsChanged()
    }

    // Track points (runs regardless of simulation state)
    this.points?.trackPoints()
  }

  private initPrograms (): void {
    if (this._isDestroyed || !this.points || !this.lines || !this.clusters) return
    this.points.initPrograms()
    this.lines.initPrograms()
    this.forceGravity?.initPrograms()
    this.forceManyBody?.initPrograms()
    this.forceCenter?.initPrograms()
    this.forceLinkIncoming?.initPrograms()
    this.forceLinkOutgoing?.initPrograms()
    this.forceMouse?.initPrograms()
    this.clusters.initPrograms()
  }

  /**
   * The rendering loop - schedules itself to run continuously
   */
  private frame (): void {
    if (this._isDestroyed) return

    // Check if simulation should end BEFORE scheduling next frame
    // This prevents one extra frame from running after simulation ends.
    // Threshold is clamped to [ALPHA_MIN, 1] and NaN-safe.
    const { store: { alpha, isSimulationRunning } } = this
    const rawThreshold = this.config.alphaStopThreshold
    const stopThreshold = Number.isFinite(rawThreshold)
      ? Math.min(1, Math.max(ALPHA_MIN, rawThreshold))
      : ALPHA_MIN
    if (alpha < stopThreshold && isSimulationRunning) {
      this.end()
    }

    this.requestAnimationFrameId = window.requestAnimationFrame((now) => {
      this.rafCallbackCount += 1
      this.updateRefreshEstimate(now)
      if (this.shouldRenderOnThisRaf(now)) {
        this.renderedFrameCount += 1
        this.renderFrame(now)
      } else {
        this.skippedFrameCount += 1
        this.traceDebugFrame('pacing-skip', {
          targetFps: this.getTargetRenderFps(),
          nextRenderEligibleMs: this.nextRenderEligibleMs,
        })
      }

      // Continue the loop (even after simulation ends)
      if (!this._isDestroyed) {
        this.frame()
      }
    })
  }

  private updateRefreshEstimate (now: number): void {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      this.lastRafFrameMs = now
      return
    }
    if (this.lastRafFrameMs > 0) {
      const dt = now - this.lastRafFrameMs
      if (dt > 3 && dt < 40) {
        const hz = 1000 / dt
        if (hz >= 30 && hz <= 360) {
          this.estimatedRefreshHz = this.estimatedRefreshHz * 0.92 + hz * 0.08
        }
      } else if (dt >= 250) {
        this.nextRenderEligibleMs = 0
      }
    }
    this.lastRafFrameMs = now
  }

  private getRoundedRefreshHz (): number {
    const common = [60, 72, 75, 90, 100, 120, 144, 165, 180, 240]
    let best = common[0]!
    let bestDiff = Math.abs(this.estimatedRefreshHz - best)
    for (const hz of common) {
      const diff = Math.abs(this.estimatedRefreshHz - hz)
      if (diff < bestDiff) {
        best = hz
        bestDiff = diff
      }
    }
    return best
  }

  private getTargetRenderFps (): number {
    const rawFrameRateLimit = this.config.frameRateLimit
    const frameRateLimit = Number.isFinite(rawFrameRateLimit) ? rawFrameRateLimit : 0
    if (frameRateLimit > 0) return frameRateLimit

    const rawHeadroom = this.config.frameRateHeadroomFps
    const headroom = Number.isFinite(rawHeadroom) ? rawHeadroom : 0
    if (headroom <= 0) return 0

    const refreshHz = this.getRoundedRefreshHz()
    if (refreshHz <= 60) return 0
    return Math.max(30, refreshHz - headroom)
  }

  private sanitizePixelRatio (ratio: number): number {
    return Number.isFinite(ratio) && ratio > 0 ? ratio : 1
  }

  private applyEffectivePixelRatio (ratio: number): boolean {
    const effectiveRatio = this.sanitizePixelRatio(ratio)
    if (this._lastAppliedDpr === effectiveRatio && this.store.effectivePixelRatio === effectiveRatio) {
      return false
    }
    this._lastAppliedDpr = effectiveRatio
    this.store.effectivePixelRatio = effectiveRatio
    if (this.device?.canvasContext) {
      this.device.canvasContext.setProps({ useDevicePixels: effectiveRatio })
      this.store.maxPointSize = getMaxPointSize(this.device, effectiveRatio)
    }
    return true
  }

  private shouldRenderOnThisRaf (now: number): boolean {
    const targetFps = this.getTargetRenderFps()
    if (targetFps <= 0) return true

    const intervalMs = 1000 / targetFps
    const epsilonMs = 0.25
    if (this.nextRenderEligibleMs === 0) {
      this.nextRenderEligibleMs = now + intervalMs
      return true
    }
    if (now + epsilonMs < this.nextRenderEligibleMs) return false

    do {
      this.nextRenderEligibleMs += intervalMs
    } while (now >= this.nextRenderEligibleMs)
    return true
  }

  /**
   * Adaptive DPR. During pan/zoom/drag/active simulation, drop the canvas's
   * effective pixel ratio to `adaptivePixelRatio` (default 1.0). On settle —
   * idle for `adaptivePixelRatioSettleMs` after the last interaction event —
   * restore the configured `pixelRatio`. Fragment cost is quadratic in pixel
   * ratio, so 2.0 → 1.0 during pan typically gives a 4× render speedup on
   * retina displays.
   */
  private maybeApplyAdaptiveDpr (nowMs: number): boolean {
    if (!this.device?.canvasContext) return false
    const setting = this.config.adaptivePixelRatio
    if (!setting) return false
    const interactionDpr = this.sanitizePixelRatio(typeof setting === 'number' ? setting : 1.0)
    const fullDpr = this.sanitizePixelRatio(this.config.pixelRatio)
    const isInteracting =
      this.dragInstance.isActive ||
      this.zoomInstance.isRunning ||
      this.store.isSimulationRunning
    if (isInteracting) {
      this._lastInteractionMs = nowMs
    }
    const settleMs = this.config.adaptivePixelRatioSettleMs ?? 150
    const settled = nowMs - this._lastInteractionMs > settleMs
    const desired = settled ? fullDpr : interactionDpr
    const changed = this.applyEffectivePixelRatio(desired)
    if (!changed) return false
    this.traceDebugFrame('dpr-change', {
      desired,
      fullDpr,
      interactionDpr,
      settled,
      nowMs,
      lastInteractionMs: this._lastInteractionMs,
    })
    return true
  }

  /**
   * Begin a hand-rolled MSAA-enabled render pass that targets the canvas.
   *
   * luma.gl 9.2.6's RenderPass abstraction doesn't expose `resolveTarget` on
   * its color attachments, so we bypass it: hand-build the
   * GPURenderPassDescriptor with the multisample texture as the `view` and
   * the canvas backbuffer as the `resolveTarget`, with `storeOp: 'discard'`
   * on the multisample view (only the resolved single-sample copy ever
   * leaves tile memory on TBDR).
   *
   * The returned object satisfies the structural contract that
   * `model.draw(pass)` relies on: a `.handle` GPURenderPassEncoder plus
   * `pushDebugGroup`/`popDebugGroup`/`end` methods. luma's RenderPipeline
   * and VertexArray only touch `pass.handle.{setPipeline,setBindGroup,
   * setVertexBuffer,setIndexBuffer,draw,drawIndexed}`, all of which exist
   * on the raw GPURenderPassEncoder.
   */
  private beginMsaaCanvasPass (
    canvasFramebuffer: Framebuffer | undefined,
    firstPass: boolean,
    backgroundColor: [number, number, number, number]
  ): RenderPass {
    // The luma Framebuffer's first color attachment wraps a luma Texture
    // around the canvas's current GPUTexture. Reach into it for the raw
    // GPUTextureView we need as the resolve target.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const canvasAttachment = canvasFramebuffer?.colorAttachments?.[0] as any
    const resolveView: GPUTextureView | undefined = canvasAttachment?.handle
    const canvasTextureHandle: GPUTexture | undefined = canvasAttachment?.texture?.handle
    if (!resolveView || !canvasTextureHandle) {
      // Defensive fallback: if we can't reach the underlying view, drop
      // MSAA for this frame so we don't crash. Should never hit on a
      // healthy WebGPU device + valid canvas context.
      console.warn('[kajillion] MSAA canvas pass: missing canvas view; falling back to single-sample.')
      return (this.device as Device).beginRenderPass({
        framebuffer: canvasFramebuffer,
        clearColor: firstPass ? backgroundColor : false,
        clearDepth: firstPass ? 1 : false,
        clearStencil: firstPass ? 0 : false,
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gpuDevice = (this.device as any).handle as GPUDevice
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const commandEncoder = (this.device as any).commandEncoder?.handle as GPUCommandEncoder

    // Lazy: allocate the MSAA target the first time we hit this path, and
    // resize whenever the canvas backbuffer dimensions change.
    this.msaaTarget ||= new MsaaTarget({
      device: gpuDevice,
      format: canvasTextureHandle.format,
      sampleCount: 4,
    })
    this.msaaTarget.ensureSize(canvasTextureHandle.width, canvasTextureHandle.height)

    const colorAttachment = this.msaaTarget.getColorAttachment(
      resolveView,
      firstPass,
      {
        r: backgroundColor[0],
        g: backgroundColor[1],
        b: backgroundColor[2],
        a: backgroundColor[3],
      }
    )

    const descriptor: GPURenderPassDescriptor = {
      label: 'kajillion-msaa-canvas-pass',
      colorAttachments: [colorAttachment],
    }

    // The timer-query pool's beginRenderPass interceptor injects
    // timestampWrites into descriptors that pass through luma's
    // `device.beginRenderPass`. We're bypassing luma here, so wire the
    // timestamps ourselves by consuming the pool's pending slot if set.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pool = this.timerQueryPool as any
    if (pool && typeof pool.consumePendingForRawPass === 'function') {
      pool.consumePendingForRawPass(descriptor)
    }

    const handle = commandEncoder.beginRenderPass(descriptor)
    return makeMsaaPassWrapper(handle) as unknown as RenderPass
  }

  /**
   * Renders a single frame (the actual rendering logic).
   * This does NOT schedule the next frame.
   */
  private renderFrame (now?: number): void {
    if (this._isDestroyed) return
    if (!this.store.pointsTextureSize) return
    this.traceDebugFrame('render-enter', { now })

    this.timerQueryPool?.tick()
    const dprChanged = this.maybeApplyAdaptiveDpr(now ?? performance.now())
    this.resizeCanvas(dprChanged)

    // Idle-frame skip: when the simulation has fully settled (alpha dropped
    // below alphaStopThreshold) AND there's no user-input event this frame
    // AND no drag in progress, the canvas content from the previous frame
    // is still on screen — re-rendering would produce identical pixels.
    // Bail out: no GPU work, no timer-query slots, no hover readback.
    // The browser keeps presenting the last-submitted swapchain image, so
    // the canvas looks unchanged at vsync rate (~60 Hz) for free.
    //
    // Re-renders are triggered automatically by:
    //   - mouse / wheel / pointer events (set `currentEvent` before this runs)
    //   - active drag (`dragInstance.isActive === true`)
    //   - sim restart (`isSimulationRunning` flips back to true; e.g. start())
    // Programmatic state changes (setColors, setSizes, etc.) must call
    // `this.markDirty()` to force a re-render on the next frame.
    const isSettled = !this.store.isSimulationRunning
    const isIdle = !this.config.disableIdleFrameSkip &&
      isSettled &&
      !this.currentEvent &&
      !this.zoomInstance.isRunning &&
      !this.dragInstance.isActive &&
      !this.isRenderDirty &&
      !dprChanged
    if (isIdle) {
      this.traceDebugFrame('idle-skip', { dprChanged, isSettled })
      return
    }
    if (this.renderDirtyFrameCount > 0) this.renderDirtyFrameCount -= 1
    this.isRenderDirty = this.renderDirtyFrameCount > 0
    this.traceDebugFrame('render-active', { dprChanged, isSettled })

    this.fpsMonitor?.begin()
    if (!this.dragInstance.isActive) {
      this.findHoveredItem()
    }

    const shouldCaptureRenderPositions =
      this.device?.info?.type === 'webgpu' &&
      this.store.isSimulationRunning &&
      !!this.points?.positionStorageBuffer &&
      !!this.points?.previousRenderPositionStorageBuffer
    if (shouldCaptureRenderPositions) {
      if (this.points?.isPositionStorageBufferDirty) {
        this.timerQueryPool?.begin('sync.position-storage')
        this.points.syncPositionStorageBuffer()
        this.timerQueryPool?.end()
      }
      this.timerQueryPool?.begin('sync.position-prev')
      this.points?.captureRenderPreviousPositions()
      this.timerQueryPool?.end()
    } else {
      this.points?.setRenderPositionInterpolation(1)
    }

    // Run simulation step (respects isSimulationRunning).
    // When simulation ends, forces stop but rendering continues.
    // When physicsTickRate > 0, physics is throttled to that rate; between ticks,
    // positions are held and only render runs. User-triggered `step()` bypasses this.
    // NaN / non-finite physicsTickRate is treated as 0 (uncapped) — silent footgun
    // if user passes e.g. parseInt(emptyString) which yields NaN.
    const rawTickRate = this.config.physicsTickRate
    const tickRate = Number.isFinite(rawTickRate) ? rawTickRate : 0
    const positionEpochBeforeSimulation = this.positionEpoch
    if (tickRate <= 0) {
      this.runSimulationStep(false)
    } else {
      const nowMs = now ?? performance.now()
      const physicsInterval = 1000 / tickRate
      if (nowMs - this.lastPhysicsTickMs >= physicsInterval) {
        this.lastPhysicsTickMs = nowMs
        this.runSimulationStep(false)
      }
    }
    const simulationAdvanced = this.positionEpoch !== positionEpochBeforeSimulation
    if (shouldCaptureRenderPositions) {
      const pointCount = this.graph.pointsNumber ?? 0
      const forceThrottleAlpha = pointCount >= INTERPOLATED_FORCE_THROTTLE_POINTS
        ? INTERPOLATED_FORCE_THROTTLE_ALPHA
        : SETTLE_TAIL_ALPHA_THRESHOLD
      const shouldInterpolateTailStep =
        simulationAdvanced &&
        this.store.isSimulationRunning &&
        this.store.alpha < forceThrottleAlpha
      this.points?.setRenderPositionInterpolation(shouldInterpolateTailStep ? 0.5 : 1)
    }

    // WebGPU vertex-pulling: refresh the position storage buffer from the
    // ping-ponged currentPositionTexture before draw. Vertex shaders read this
    // buffer directly instead of paying for textureSampleLevel from the vertex
    // stage (a TBDR slow path that cost ~750ms/frame at n=100k before this).
    if (this.points?.isPositionStorageBufferDirty) {
      this.timerQueryPool?.begin('sync.position-storage')
      this.points.syncPositionStorageBuffer()
      this.timerQueryPool?.end()
    }

    // Create a single render pass for drawing (points, lines, etc.)
    // Simulation will use separate render passes later
    if (this.device) {
      const backgroundColor = this.store.backgroundColor ?? [0, 0, 0, 1]
      // 2D-only pass: drop the canvas's default depth attachment so the pipelines
      // (no depthWriteEnabled) match the render pass attachment state.
      const canvasFramebuffer = this.device.canvasContext?.getCurrentFramebuffer({ depthStencilFormat: false })

      const { config: { renderLinks } } = this
      const shouldDrawLinks =
        renderLinks !== false &&
        !!this.store.linksTextureSize &&
        !!this.graph.linksNumber &&
        this.graph.linksNumber > 0

      const isWebGPU = this.device.info?.type === 'webgpu'
      const msaaActive = isWebGPU && this.config.msaa > 1
      const shouldRenderPointImpostors = this.shouldRenderPointImpostors()
      let lineCullingReady = false
      if (shouldDrawLinks) {
        this.timerQueryPool?.begin('render.lines.cull')
        lineCullingReady = this.lines?.prepareGpuCulledDraw() ?? false
        this.timerQueryPool?.end()
      }
      let pointImpostorsReady = false
      if (shouldRenderPointImpostors) {
        this.timerQueryPool?.begin('render.points.tile-bin')
        pointImpostorsReady = this.points?.renderImpostorDensity() ?? false
        this.timerQueryPool?.end()
      }
      let pointCullingReady = false
      if (!pointImpostorsReady) {
        this.timerQueryPool?.begin('render.points.cull')
        pointCullingReady = this.points?.prepareGpuCulledDraw() ?? false
        this.timerQueryPool?.end()
      }
      this.traceDebugFrame('render-pass-ready', {
        isWebGPU,
        msaaActive,
        shouldDrawLinks,
        lineCullingReady,
        shouldRenderPointImpostors,
        pointImpostorsReady,
        pointCullingReady,
        canvasWidth: this.canvas.width,
        canvasHeight: this.canvas.height,
      })

      if (msaaActive) {
        // MSAA requires a *single* render pass for all canvas content: the
        // resolve happens at pass-end and writes resolveTarget = avg(samples),
        // which would overwrite (not blend over) a prior pass's resolved
        // output. Splitting lines/points into separate passes — even with
        // loadOp:'load' on the canvas — corrupts the composite because the
        // multisample target is `storeOp:'discard'` (samples don't survive
        // between passes; loading would read undefined). One combined pass,
        // one resolve, one timestamp slot.
        this.timerQueryPool?.begin('render.canvas')
        const pass = this.beginMsaaCanvasPass(canvasFramebuffer, true, backgroundColor)
        if (shouldDrawLinks) this.lines?.draw(pass, lineCullingReady)
        if (pointImpostorsReady && this.points?.drawImpostorComposite(pass)) {
          if (this.config.impostorExactOverlay) this.points?.drawImpostorExactOverlay(pass)
        } else {
          this.points?.draw(pass, pointCullingReady)
        }
        pass.end()
        this.timerQueryPool?.end()
      } else {
        // Non-MSAA: lines and points run as separate render passes so
        // WebGPU's timestampWrites can attach to each independently; on
        // WebGL2 the split is a no-op cost-wise. Only the first pass
        // clears; subsequent passes load the existing attachment so output
        // composes correctly.
        let firstPass = true
        const startPass = (): RenderPass => {
          const pass = (this.device as Device).beginRenderPass({
            framebuffer: canvasFramebuffer,
            clearColor: firstPass ? backgroundColor : false,
            clearDepth: firstPass ? 1 : false,
            clearStencil: firstPass ? 0 : false,
          })
          firstPass = false
          return pass
        }

        if (shouldDrawLinks) {
          this.timerQueryPool?.begin('render.lines')
          const linesPass = startPass()
          this.lines?.draw(linesPass, lineCullingReady)
          linesPass.end()
          this.timerQueryPool?.end()
        }

        this.timerQueryPool?.begin('render.points')
        const pointsPass = startPass()
        if (pointImpostorsReady && this.points?.drawImpostorComposite(pointsPass)) {
          if (this.config.impostorExactOverlay) this.points?.drawImpostorExactOverlay(pointsPass)
        } else {
          this.points?.draw(pointsPass, pointCullingReady)
        }
        pointsPass.end()
        this.timerQueryPool?.end()
      }

      if (this.dragInstance.isActive) {
        // Swap-before-write: after the swap, `previous` holds the freshest positions so drag()
        // reads those and writes the drag result into `current`. drag/trackPoints
        // are independent of the canvas render pass — they use their own FBOs.
        this.points?.swapFbo()
        this.points?.drag()
        this.points?.trackPoints()
        this.markPointPositionsChanged()
      }

      this.device.submit()
      this.traceDebugFrame('submit')
    }

    this.fpsMonitor?.end(now ?? performance.now())

    this.currentEvent = undefined
    this.traceDebugFrame('render-exit')
  }

  private stopFrames (): void {
    if (this.requestAnimationFrameId) {
      window.cancelAnimationFrame(this.requestAnimationFrameId)
      this.requestAnimationFrameId = 0 // Reset to 0
    }
  }

  /**
   * Starts continuous rendering
   */
  private startFrames (): void {
    if (this._isDestroyed) return
    this.stopFrames() // Stop any existing rendering
    this.frame() // Start the loop
  }

  /**
   * Called automatically when simulation completes (alpha < alphaStopThreshold).
   * Rendering continues after this is called (for rendering/interaction).
   */
  private end (): void {
    this.store.isSimulationRunning = false
    this.store.simulationProgress = 1
    this.lastSimTickMs = 0
    this.lastPhysicsTickMs = Number.NEGATIVE_INFINITY
    this.config.onSimulationEnd?.()
    this.requestWebGpuPointPositionsSnapshot(true)
    // Force hover detection on next frame since points may have moved under stationary mouse
    this._shouldForceHoverDetection = true
  }

  private onClick (event: MouseEvent): void {
    this.config.onClick?.(
      this.store.hoveredPoint?.index,
      this.store.hoveredPoint?.position,
      event
    )

    if (this.store.hoveredPoint) {
      this.config.onPointClick?.(
        this.store.hoveredPoint.index,
        this.store.hoveredPoint.position,
        event
      )
    } else if (this.store.hoveredLinkIndex !== undefined) {
      this.config.onLinkClick?.(
        this.store.hoveredLinkIndex,
        event
      )
    } else {
      this.config.onBackgroundClick?.(
        event
      )
    }
  }

  private updateMousePosition (event: MouseEvent | D3DragEvent<HTMLCanvasElement, undefined, Hovered>): void {
    if (!event) return
    const mouseX = (event as MouseEvent).offsetX ?? (event as D3DragEvent<HTMLCanvasElement, undefined, Hovered>).x
    const mouseY = (event as MouseEvent).offsetY ?? (event as D3DragEvent<HTMLCanvasElement, undefined, Hovered>).y
    if (mouseX === undefined || mouseY === undefined) return
    this.store.mousePosition = this.zoomInstance.convertScreenToSpacePosition([mouseX, mouseY])
    this.store.screenMousePosition = [mouseX, (this.store.screenSize[1] - mouseY)]
  }

  private onMouseMove (event: MouseEvent): void {
    this.currentEvent = event
    this.markRenderDirty()
    this.traceDebugFrame('mouse-move', { x: event.clientX, y: event.clientY })
    this.updateMousePosition(event)
    this.isRightClickMouse = event.which === 3
    this.config.onMouseMove?.(
      this.store.hoveredPoint?.index,
      this.store.hoveredPoint?.position,
      this.currentEvent
    )
  }

  private onContextMenu (event: MouseEvent): void {
    event.preventDefault()

    this.config.onContextMenu?.(
      this.store.hoveredPoint?.index,
      this.store.hoveredPoint?.position,
      event
    )

    if (this.store.hoveredPoint) {
      this.config.onPointContextMenu?.(
        this.store.hoveredPoint.index,
        this.store.hoveredPoint.position,
        event
      )
    } else if (this.store.hoveredLinkIndex !== undefined) {
      this.config.onLinkContextMenu?.(
        this.store.hoveredLinkIndex,
        event
      )
    } else {
      this.config.onBackgroundContextMenu?.(
        event
      )
    }
  }

  private resizeCanvas (forceResize = false): void {
    if (this._isDestroyed) return
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    const [prevW, prevH] = this.store.screenSize

    // Check if CSS size changed (luma.gl's autoResize handles canvas.width/height automatically)
    if (forceResize || prevW !== w || prevH !== h) {
      const { k } = this.zoomInstance.eventTransform
      const centerPosition = this.zoomInstance.convertScreenToSpacePosition([prevW / 2, prevH / 2])
      this.traceDebugFrame('resize', {
        forceResize,
        prevW,
        prevH,
        w,
        h,
        centerX: centerPosition[0],
        centerY: centerPosition[1],
        k,
      })

      this.store.updateScreenSize(w, h)
      this.zoomInstance.updateTranslateExtent()
      // Note: canvas.width and canvas.height are managed by luma.gl's autoResize
      // We only update our internal state and dependent components
      const nextTransform = this.zoomInstance.constrainTransform(this.zoomInstance.getTransform(centerPosition, k))
      this.canvasD3Selection
        ?.call(this.zoomInstance.behavior.transform, nextTransform)
      this.points?.updateSampledPointsGrid()
      this.lines?.updateSampledLinksGrid()
      // Only update link index FBO if link hovering is enabled
      if (this.store.isLinkHoveringEnabled) {
        this.lines?.updateLinkIndexFbo()
      }
    }
  }

  private updateZoomDragBehaviors (): void {
    if (this.config.enableDrag) {
      this.canvasD3Selection?.call(this.dragInstance.behavior)
    } else {
      this.canvasD3Selection
        ?.call(this.dragInstance.behavior)
        .on('.drag', null)
    }

    if (this.config.enableZoom) {
      this.canvasD3Selection?.call(this.zoomInstance.behavior)
    } else {
      this.canvasD3Selection
        ?.call(this.zoomInstance.behavior)
        .on('wheel.zoom', null)
    }
  }

  private findHoveredItem (): void {
    if (this._isDestroyed || !this._isMouseOnCanvas) return
    const pointHoveringEnabled = !!(
      this.config.enableDrag ||
      this.config.renderHoveredPointRing ||
      this.config.onPointClick ||
      this.config.onPointContextMenu ||
      this.config.onPointMouseOver ||
      this.config.onPointMouseOut
    )
    if (!pointHoveringEnabled && !this.store.isLinkHoveringEnabled) {
      if (this.store.hoveredPoint !== undefined) this.store.hoveredPoint = undefined
      if (this.store.hoveredLinkIndex !== undefined) this.store.hoveredLinkIndex = undefined
      return
    }
    if (this._findHoveredItemExecutionCount < MAX_HOVER_DETECTION_DELAY) {
      this._findHoveredItemExecutionCount += 1
      return
    }

    // Check if mouse has moved significantly since last hover detection
    const deltaX = Math.abs(this._lastMouseX - this._lastCheckedMouseX)
    const deltaY = Math.abs(this._lastMouseY - this._lastCheckedMouseY)
    const mouseMoved = deltaX > MIN_MOUSE_MOVEMENT_THRESHOLD || deltaY > MIN_MOUSE_MOVEMENT_THRESHOLD

    // Skip if mouse hasn't moved AND not forced
    if (!mouseMoved && !this._shouldForceHoverDetection) {
      return
    }

    // Update last checked position
    this._lastCheckedMouseX = this._lastMouseX
    this._lastCheckedMouseY = this._lastMouseY

    // Reset force flag after use
    this._shouldForceHoverDetection = false

    this._findHoveredItemExecutionCount = 0

    // Two-phase hover detection: first update state, then fire callbacks.
    // This guarantees mouseout fires before mouseover when transitioning
    // between element types (e.g. link -> point).
    const { point, link } = this.device?.info?.type === 'webgpu'
      ? this.findHoveredItemOnGpu()
      : this.findHoveredItemOnCpu()

    // Fire mouseout events first
    if (point.mouseout) this.config.onPointMouseOut?.(this.currentEvent)
    if (link.mouseout) this.config.onLinkMouseOut?.(this.currentEvent)

    // Then fire mouseover events
    if (point.mouseover && this.store.hoveredPoint) {
      const idx = this.store.hoveredPoint.index
      this.config.onPointMouseOver?.(
        this.store.hoveredPoint.index,
        this.store.hoveredPoint.position,
        this.currentEvent,
        this.store.highlightedPointSet?.has(idx) ?? false,
        this.store.outlinedPointSet?.has(idx) ?? false
      )
    }
    if (link.mouseover && this.store.hoveredLinkIndex !== undefined) {
      this.config.onLinkMouseOver?.(this.store.hoveredLinkIndex)
    }

    this.updateCanvasCursor()
  }

  private findHoveredItemOnCpu (): { point: { mouseover: boolean; mouseout: boolean }; link: { mouseover: boolean; mouseout: boolean } } {
    const point = this.findHoveredPoint()
    let link = { mouseover: false, mouseout: false }

    if (this.graph.linksNumber && this.store.isLinkHoveringEnabled) {
      link = this.findHoveredLine()
    } else if (this.store.hoveredLinkIndex !== undefined) {
      link.mouseout = true
      this.store.hoveredLinkIndex = undefined
    }

    return { point, link }
  }

  private findHoveredItemOnGpu (): { point: { mouseover: boolean; mouseout: boolean }; link: { mouseover: boolean; mouseout: boolean } } {
    const point = this.findHoveredPointOnCpu()
    let link = { mouseover: false, mouseout: false }

    if (this.graph.linksNumber && this.store.isLinkHoveringEnabled && !this.store.hoveredPoint) {
      link = this.findHoveredLineOnCpu()
    } else if (this.store.hoveredLinkIndex !== undefined) {
      link.mouseout = true
      this.store.hoveredLinkIndex = undefined
    }

    return { point, link }
  }

  /** Detect hovered point and update store state. Returns flags for deferred callback firing. */
  private findHoveredPoint (): { mouseover: boolean; mouseout: boolean } {
    if (this._isDestroyed || !this.device || !this.points) return { mouseover: false, mouseout: false }
    if (this.device.info?.type === 'webgpu') return this.findHoveredPointOnCpu()
    this.points.findHoveredPoint()
    let isMouseover = false
    let isMouseout = false
    const pixels = readPixels(this.device, this.points.hoveredFbo as Framebuffer, 0, 0, 2, 2)
    // Shader writes: rgba = vec4(index, size, pointPosition.xy)
    const hoveredIndex = pixels[0] as number
    const pointSize = pixels[1] as number
    const pointX = pixels[2] as number
    const pointY = pixels[3] as number

    if (pointSize > 0) {
      if (this.store.hoveredPoint === undefined || this.store.hoveredPoint.index !== hoveredIndex) {
        isMouseover = true
      }
      this.store.hoveredPoint = {
        index: hoveredIndex,
        position: [pointX, pointY],
      }
    } else {
      if (this.store.hoveredPoint) isMouseout = true
      this.store.hoveredPoint = undefined
    }

    return { mouseover: isMouseover, mouseout: isMouseout }
  }

  private findHoveredPointOnCpu (): { mouseover: boolean; mouseout: boolean } {
    if (this.cachedWebGpuPointPositionsEpoch < this.positionEpoch && !this.store.isSimulationRunning) {
      this.requestWebGpuPointPositionsSnapshot()
    }
    const positions = this.cachedWebGpuPointPositions ?? this.graph.inputPointPositions
    if (!positions) {
      return { mouseover: false, mouseout: false }
    }
    if (!this.webGpuPointPickerGrid || this.webGpuPointPickerGrid.positions !== positions) {
      this.rebuildWebGpuPointPickerGrid(positions)
    }
    const grid = this.webGpuPointPickerGrid
    if (!grid) return { mouseover: false, mouseout: false }

    const mouseX = this.store.mousePosition[0] ?? NaN
    const mouseY = this.store.mousePosition[1] ?? NaN
    if (!Number.isFinite(mouseX) || !Number.isFinite(mouseY)) return { mouseover: false, mouseout: false }

    const screenMouseX = this.store.screenMousePosition[0] ?? 0
    const screenMouseY = this.store.screenSize[1] - (this.store.screenMousePosition[1] ?? this.store.screenSize[1])
    const k = Math.max(0.001, this.zoomInstance.eventTransform.k)
    const maxScreenRadius = Math.max(8, this.store.maxPointSize + 6)
    const radiusSpace = Math.max(grid.cellSize, (maxScreenRadius / k) * 1.5)
    const minCx = Math.max(0, Math.floor((mouseX - radiusSpace) / grid.cellSize))
    const maxCx = Math.min(grid.columns - 1, Math.floor((mouseX + radiusSpace) / grid.cellSize))
    const minCy = Math.max(0, Math.floor((mouseY - radiusSpace) / grid.cellSize))
    const maxCy = Math.min(grid.rows - 1, Math.floor((mouseY + radiusSpace) / grid.cellSize))
    const sizes = this.graph.pointSizes
    const imageSizes = this.graph.pointImageSizes
    const screenWidth = this.store.screenSize[0] ?? 0
    const screenHeight = this.store.screenSize[1] ?? 0
    const spaceSize = this.store.adjustedSpaceSize
    const offsetX = (screenWidth - spaceSize) / 2
    const offsetY = (screenHeight - spaceSize) / 2
    const transform = this.zoomInstance.eventTransform
    let bestIndex = -1
    let bestDistanceSq = Infinity
    let bestX = 0
    let bestY = 0

    for (let cy = minCy; cy <= maxCy; cy += 1) {
      for (let cx = minCx; cx <= maxCx; cx += 1) {
        const bucket = grid.buckets[cy * grid.columns + cx]
        if (!bucket) continue
        // eslint-disable-next-line unicorn/no-for-loop -- Indexing avoids iterator overhead in pointer-move hit testing.
        for (let bucketIndex = 0; bucketIndex < bucket.length; bucketIndex += 1) {
          const index = bucket[bucketIndex] ?? -1
          if (index < 0) continue
          const px = grid.positions[index * 2]
          const py = grid.positions[index * 2 + 1]
          if (px === undefined || py === undefined) continue
          const sx = transform.x + (offsetX + px) * k
          const sy = transform.y + (offsetY + spaceSize - py) * k
          const dx = sx - screenMouseX
          const dy = sy - screenMouseY
          const distanceSq = dx * dx + dy * dy
          const pointSize = Math.max(sizes?.[index] ?? this.config.pointDefaultSize, imageSizes?.[index] ?? 0) * this.config.pointSizeScale
          const scaledSize = this.config.scalePointsOnZoom
            ? pointSize * k
            : pointSize * Math.min(5.0, Math.max(1.0, k * 0.01))
          const hitRadius = Math.min(scaledSize, this.store.maxPointSize) / 2 + 4
          if (distanceSq <= hitRadius * hitRadius && distanceSq < bestDistanceSq) {
            bestIndex = index
            bestDistanceSq = distanceSq
            bestX = px
            bestY = py
          }
        }
      }
    }

    let isMouseover = false
    let isMouseout = false
    if (bestIndex >= 0) {
      if (this.store.hoveredPoint === undefined || this.store.hoveredPoint.index !== bestIndex) {
        isMouseover = true
      }
      this.store.hoveredPoint = {
        index: bestIndex,
        position: [bestX, bestY],
      }
    } else {
      if (this.store.hoveredPoint) isMouseout = true
      this.store.hoveredPoint = undefined
    }

    return { mouseover: isMouseover, mouseout: isMouseout }
  }

  /** Detect hovered link and update store state. Returns flags for deferred callback firing. */
  private findHoveredLine (): { mouseover: boolean; mouseout: boolean } {
    if (this._isDestroyed || !this.lines || !this.device) return { mouseover: false, mouseout: false }
    if (this.device.info?.type === 'webgpu') {
      return this.findHoveredLineOnCpu()
    }
    if (this.store.hoveredPoint) {
      const wasLinkHovered = this.store.hoveredLinkIndex !== undefined
      if (wasLinkHovered) {
        this.store.hoveredLinkIndex = undefined
      }
      return { mouseover: false, mouseout: wasLinkHovered }
    }
    this.lines.findHoveredLine()
    let isMouseover = false
    let isMouseout = false

    const pixels = readPixels(this.device, this.lines.hoveredLineIndexFbo!)
    const hoveredLineIndex = pixels[0] as number

    if (hoveredLineIndex >= 0) {
      if (this.store.hoveredLinkIndex !== hoveredLineIndex) isMouseover = true
      this.store.hoveredLinkIndex = hoveredLineIndex
    } else {
      if (this.store.hoveredLinkIndex !== undefined) isMouseout = true
      this.store.hoveredLinkIndex = undefined
    }

    return { mouseover: isMouseover, mouseout: isMouseout }
  }

  private findHoveredLineOnCpu (): { mouseover: boolean; mouseout: boolean } {
    if (this.store.hoveredPoint) {
      const wasLinkHovered = this.store.hoveredLinkIndex !== undefined
      if (wasLinkHovered) this.store.hoveredLinkIndex = undefined
      return { mouseover: false, mouseout: wasLinkHovered }
    }
    if (this.cachedWebGpuPointPositionsEpoch < this.positionEpoch && !this.store.isSimulationRunning) {
      this.requestWebGpuPointPositionsSnapshot()
    }
    const positions = this.cachedWebGpuPointPositions ?? this.graph.inputPointPositions
    const links = this.graph.links
    const linksNumber = this.graph.linksNumber ?? 0
    if (!positions || !links || linksNumber === 0) {
      const wasLinkHovered = this.store.hoveredLinkIndex !== undefined
      this.store.hoveredLinkIndex = undefined
      return { mouseover: false, mouseout: wasLinkHovered }
    }
    if (!this.webGpuLinkPickerGrid || this.webGpuLinkPickerGrid.positions !== positions || this.webGpuLinkPickerGrid.links !== links) {
      this.rebuildWebGpuLinkPickerGrid(positions)
    }
    const grid = this.webGpuLinkPickerGrid
    if (!grid) {
      const wasLinkHovered = this.store.hoveredLinkIndex !== undefined
      this.store.hoveredLinkIndex = undefined
      return { mouseover: false, mouseout: wasLinkHovered }
    }

    const mouseX = this.store.mousePosition[0] ?? NaN
    const mouseY = this.store.mousePosition[1] ?? NaN
    if (!Number.isFinite(mouseX) || !Number.isFinite(mouseY)) {
      const wasLinkHovered = this.store.hoveredLinkIndex !== undefined
      this.store.hoveredLinkIndex = undefined
      return { mouseover: false, mouseout: wasLinkHovered }
    }
    const screenMouseX = this.store.screenMousePosition[0] ?? 0
    const screenMouseY = this.store.screenSize[1] - (this.store.screenMousePosition[1] ?? this.store.screenSize[1])
    const k = Math.max(0.001, this.zoomInstance.eventTransform.k)
    const maxPickRadiusPx = (
      this.store.maxPointSize * 2 +
      5 +
      this.config.hoveredLinkWidthIncrease +
      this.config.focusedLinkWidthIncrease +
      0.5
    ) / 2
    const radiusSpace = Math.max(grid.cellSize, (Math.max(4, maxPickRadiusPx) / k) * 2)
    const minCx = Math.max(0, Math.floor((mouseX - radiusSpace) / grid.cellSize))
    const maxCx = Math.min(grid.columns - 1, Math.floor((mouseX + radiusSpace) / grid.cellSize))
    const minCy = Math.max(0, Math.floor((mouseY - radiusSpace) / grid.cellSize))
    const maxCy = Math.min(grid.rows - 1, Math.floor((mouseY + radiusSpace) / grid.cellSize))
    const screenWidth = this.store.screenSize[0] ?? 0
    const screenHeight = this.store.screenSize[1] ?? 0
    const spaceSize = this.store.adjustedSpaceSize
    const offsetX = (screenWidth - spaceSize) / 2
    const offsetY = (screenHeight - spaceSize) / 2
    const transform = this.zoomInstance.eventTransform
    const linkWidths = this.graph.linkWidths
    const linkArrows = this.graph.linkArrows
    const widthScale = this.config.linkWidthScale
    const zoomWidthScale = this.config.scaleLinksOnZoom ? k : Math.min(5.0, Math.max(1.0, k * 0.01))
    let bestIndex = -1
    let bestDistanceSq = Infinity

    let visitToken = grid.visitToken + 1
    if (visitToken > 0xffff_fffe) {
      grid.visitMarks.fill(0)
      visitToken = 1
    }
    grid.visitToken = visitToken

    for (let cy = minCy; cy <= maxCy; cy += 1) {
      for (let cx = minCx; cx <= maxCx; cx += 1) {
        const cell = cy * grid.columns + cx
        const start = grid.cellOffsets[cell] ?? 0
        const end = grid.cellOffsets[cell + 1] ?? start
        for (let entryIndex = start; entryIndex < end; entryIndex += 1) {
          const i = grid.cellEntries[entryIndex] ?? -1
          if (i < 0 || i >= linksNumber || grid.visitMarks[i] === visitToken) continue
          grid.visitMarks[i] = visitToken
          const source = links[i * 2]
          const target = links[i * 2 + 1]
          if (source === undefined || target === undefined) continue
          const sx = positions[source * 2]
          const sy = positions[source * 2 + 1]
          const tx = positions[target * 2]
          const ty = positions[target * 2 + 1]
          if (sx === undefined || sy === undefined || tx === undefined || ty === undefined) continue
          const dxWorld = tx - sx
          const dyWorld = ty - sy
          const worldDistance = Math.sqrt(dxWorld * dxWorld + dyWorld * dyWorld)
          if (this.config.linkMinPixelLength > 0 && worldDistance * k < this.config.linkMinPixelLength) continue
          const distanceSq = this.distanceToLinkHoverPathScreenSquared(
            screenMouseX,
            screenMouseY,
            sx,
            sy,
            tx,
            ty,
            i,
            transform.x,
            transform.y,
            k,
            offsetX,
            offsetY,
            spaceSize
          )
          const hasArrow = (linkArrows?.[i] ?? +this.config.linkDefaultArrows) > 0.5
          const rawWidth = (linkWidths?.[i] ?? this.config.linkDefaultWidth) * widthScale
          const arrowWidth = hasArrow ? rawWidth * 2 * this.config.linkArrowsSizeScale : rawWidth
          const cap = hasArrow ? this.store.maxPointSize * 2 : this.store.maxPointSize
          let widthPx = Math.min(Math.max(rawWidth, arrowWidth) * zoomWidthScale, cap)
          widthPx += 5 + 0.5
          if (this.store.hoveredLinkIndex === i) widthPx += this.config.hoveredLinkWidthIncrease
          if (this.config.focusedLinkIndex === i) widthPx += this.config.focusedLinkWidthIncrease
          const threshold = widthPx / 2
          if (distanceSq <= threshold * threshold && distanceSq < bestDistanceSq) {
            bestDistanceSq = distanceSq
            bestIndex = i
          }
        }
      }
    }

    let isMouseover = false
    let isMouseout = false
    if (bestIndex >= 0) {
      if (this.store.hoveredLinkIndex !== bestIndex) isMouseover = true
      this.store.hoveredLinkIndex = bestIndex
    } else {
      if (this.store.hoveredLinkIndex !== undefined) isMouseout = true
      this.store.hoveredLinkIndex = undefined
    }
    return { mouseover: isMouseover, mouseout: isMouseout }
  }

  private distanceToScreenSegmentSquared (px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1
    const dy = y2 - y1
    const lenSq = dx * dx + dy * dy
    if (lenSq === 0) {
      const ox = px - x1
      const oy = py - y1
      return ox * ox + oy * oy
    }
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq))
    const cx = x1 + t * dx
    const cy = y1 + t * dy
    const ox = px - cx
    const oy = py - cy
    return ox * ox + oy * oy
  }

  private updateCanvasCursor (): void {
    const { hoveredPointCursor, hoveredLinkCursor } = this.config
    if (this.dragInstance.isActive) select(this.canvas).style('cursor', 'grabbing')
    else if (this.store.hoveredPoint) {
      if (!this.config.enableDrag || this.store.isSpaceKeyPressed) select(this.canvas).style('cursor', hoveredPointCursor)
      else select(this.canvas).style('cursor', 'grab')
    } else if (this.store.isLinkHoveringEnabled && this.store.hoveredLinkIndex !== undefined) {
      select(this.canvas).style('cursor', hoveredLinkCursor)
    } else select(this.canvas).style('cursor', null)
  }

  private addAttribution (): void {
    if (!this.config.attribution) return
    this.attributionDivElement = document.createElement('div')
    this.attributionDivElement.style.cssText = `
      user-select: none;
      position: absolute;
      bottom: 0;
      right: 0;
      color: var(--cosmosgl-attribution-color);
      margin: 0 0.6rem 0.6rem 0;
      font-size: 0.7rem;
      font-family: inherit;
    `
    // Sanitize the attribution HTML content to prevent XSS attacks
    // Use more permissive settings for attribution since it's controlled by the library user
    this.attributionDivElement.innerHTML = sanitizeHtml(this.config.attribution, {
      ALLOWED_TAGS: ['a', 'b', 'i', 'em', 'strong', 'span', 'div', 'p', 'br', 'img'],
      ALLOWED_ATTR: ['href', 'target', 'class', 'id', 'style', 'src', 'alt', 'title'],
    })
    this.store.div?.appendChild(this.attributionDivElement)
  }
}

export type { GraphConfig } from './config'
export type { GpuPassTiming, GpuTimingSnapshot } from './perf'
export { PointShape } from './modules/GraphData'

export * from './variables'
export * from './helper'
