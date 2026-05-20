import type { Device } from '@luma.gl/core'
import type { D3DragEvent } from 'd3-drag'
import type { Selection } from 'd3-selection'

import type { GraphConfigInterface } from '@/graph/config'
import type { Clusters } from '@/graph/modules/Clusters'
import { FPSMonitor } from '@/graph/modules/FPSMonitor'
import type { ForceCenter } from '@/graph/modules/ForceCenter'
import type { ForceGravity } from '@/graph/modules/ForceGravity'
import type { ForceLink } from '@/graph/modules/ForceLink'
import type { ForceManyBody } from '@/graph/modules/ForceManyBody'
import type { ForceMouse } from '@/graph/modules/ForceMouse'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Lines } from '@/graph/modules/Lines'
import type { Points } from '@/graph/modules/Points'
import type { Hovered, Store } from '@/graph/modules/Store'
import type { Drag } from '@/graph/modules/Drag'
import type { NativeZoomEvent, Zoom } from '@/graph/modules/Zoom'
import { createTimerQueryPool, type ITimerQueryPool } from '@/graph/perf'
import { createAttributionElement } from '@/graph/graph/attribution'
import { validateGraphDevice } from '@/graph/graph/device'
import type { HoverRuntimeState } from '@/graph/graph/hover-runtime'
import { shouldCheckHoverRuntimeForCurrentMousePosition } from '@/graph/graph/hover-runtime'
import {
  applyInitialStoreConfig,
  createGraphRuntimeModules,
  initializeCanvasState,
} from '@/graph/graph/runtime-setup'
import { setupGraphEventHandlers } from '@/graph/graph/runtime-events'
import {
  handleGraphClick,
  handleGraphContextMenu,
  handleGraphMouseMove,
  updateGraphCanvasCursor,
  updateGraphMousePosition,
} from '@/graph/graph/runtime-event-actions'

export interface RuntimeInitializationInput {
  device: Device;
  div: HTMLDivElement;
  hasExternalDevice: boolean;
  config: GraphConfigInterface;
  store: Store;
  graph: GraphData;
  zoomInstance: Zoom;
  dragInstance: Drag;
  hoverState: HoverRuntimeState;
  applyEffectivePixelRatio: (ratio: number) => void;
  sanitizePixelRatio: (ratio: number) => number;
  updateZoomDragBehaviors: () => void;
  setZoomLevel: (value: number) => void;
  markRenderDirty: () => void;
  traceDebugFrame: (name: string, data?: Record<string, unknown>) => void;
  setCurrentEvent: (event: NativeZoomEvent | D3DragEvent<HTMLCanvasElement, undefined, Hovered> | MouseEvent | undefined) => void;
  setRightClickMouse: (value: boolean) => void;
}

export interface RuntimeInitializationState {
  canvas: HTMLCanvasElement;
  attributionDivElement: HTMLElement | undefined;
  canvasD3Selection: Selection<HTMLCanvasElement, undefined, null, undefined>;
  points: Points;
  lines: Lines;
  forceGravity: ForceGravity | undefined;
  forceCenter: ForceCenter | undefined;
  forceManyBody: ForceManyBody | undefined;
  forceLinkIncoming: ForceLink | undefined;
  forceLinkOutgoing: ForceLink | undefined;
  forceMouse: ForceMouse | undefined;
  clusters: Clusters;
  fpsMonitor: FPSMonitor | undefined;
  timerQueryPool: ITimerQueryPool | undefined;
}

export function initializeGraphRuntime (input: RuntimeInitializationInput): RuntimeInitializationState {
  const { device, div, config, store, graph, zoomInstance, dragInstance, hoverState } = input
  const deviceCanvasContext = validateGraphDevice(device)
  if (device.info?.type !== 'webgpu' && config.msaa !== 1) {
    console.warn('[kajillion] msaa > 1 is WebGPU-only; using msaa=1 for this device.')
    config.msaa = 1
  }

  if (input.hasExternalDevice) {
    input.applyEffectivePixelRatio(config.pixelRatio)
  } else {
    store.effectivePixelRatio = input.sanitizePixelRatio(config.pixelRatio)
  }

  const canvas = deviceCanvasContext.canvas as HTMLCanvasElement
  if (canvas.parentNode !== div) {
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas)
    div.appendChild(canvas)
  }

  initializeCanvasState({ device, canvas, div, config, store, zoomInstance })
  const attributionDivElement = createAttributionElement(config.attribution)
  if (attributionDivElement) store.div?.appendChild(attributionDivElement)

  const canvasD3Selection = setupGraphEventHandlers({
    canvas,
    config,
    store,
    zoomInstance,
    dragInstance,
    markRenderDirty: input.markRenderDirty,
    traceDebugFrame: input.traceDebugFrame,
    shouldCheckHoverForCurrentMousePosition: () => shouldCheckHoverRuntimeForCurrentMousePosition(hoverState),
    updateCanvasCursor: () => updateGraphCanvasCursor(canvas, config, store, dragInstance.isActive),
    updateMousePosition: event => updateGraphMousePosition(store, zoomInstance, event),
    onClick: event => handleGraphClick({ config, store }, event),
    onMouseMove: event => {
      input.setCurrentEvent(event)
      input.traceDebugFrame('mouse-move', { x: event.clientX, y: event.clientY })
      updateGraphMousePosition(store, zoomInstance, event)
      input.setRightClickMouse(event.which === 3)
      handleGraphMouseMove({ config, store }, event)
    },
    onContextMenu: event => handleGraphContextMenu({ config, store }, event),
    setMouseOnCanvas: value => { hoverState.isMouseOnCanvas = value },
    setLastMousePosition: (x, y) => {
      hoverState.lastMouseX = x
      hoverState.lastMouseY = y
    },
    setCurrentEvent: input.setCurrentEvent,
    setRightClickMouse: input.setRightClickMouse,
    forceHoverDetection: () => { hoverState.shouldForceHoverDetection = true },
  })
  if (!config.enableZoom || !config.enableDrag) input.updateZoomDragBehaviors()
  input.setZoomLevel(config.initialZoomLevel ?? 1)
  const modules = createGraphRuntimeModules(device, config, store, graph)
  applyInitialStoreConfig(config, store)
  if (config.randomSeed !== undefined) store.addRandomSeed(config.randomSeed)

  return {
    canvas,
    attributionDivElement,
    canvasD3Selection,
    points: modules.points,
    lines: modules.lines,
    forceGravity: modules.forceGravity,
    forceCenter: modules.forceCenter,
    forceManyBody: modules.forceManyBody,
    forceLinkIncoming: modules.forceLinkIncoming,
    forceLinkOutgoing: modules.forceLinkOutgoing,
    forceMouse: modules.forceMouse,
    clusters: modules.clusters,
    fpsMonitor: config.showFPSMonitor ? new FPSMonitor(canvas) : undefined,
    timerQueryPool: config.enableGpuTimings ? createTimerQueryPool(device) : undefined,
  }
}
