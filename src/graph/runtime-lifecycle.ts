import type { Device } from '@luma.gl/core'
import type { Selection } from 'd3-selection'

import { type GraphConfig, type GraphConfigInterface, applyConfig } from '@/graph/config'
import type { Clusters } from '@/graph/modules/Clusters'
import type { Drag } from '@/graph/modules/Drag'
import type { FPSMonitor } from '@/graph/modules/FPSMonitor'
import type { ForceCenter } from '@/graph/modules/ForceCenter'
import type { ForceGravity } from '@/graph/modules/ForceGravity'
import type { ForceLink } from '@/graph/modules/ForceLink'
import type { ForceManyBody } from '@/graph/modules/ForceManyBody'
import type { ForceMouse } from '@/graph/modules/ForceMouse'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Lines } from '@/graph/modules/Lines'
import type { Points } from '@/graph/modules/Points'
import type { Store } from '@/graph/modules/Store'
import type { Zoom } from '@/graph/modules/Zoom'
import type { ITimerQueryPool } from '@/graph/perf'
import type { MsaaTarget } from '@/graph/render/msaa-target'
import { sanitizePixelRatio } from '@/graph/graph/adaptive-dpr'
import { createGraphDevice } from '@/graph/graph/device'
import { destroyGraphRuntime } from '@/graph/graph/runtime-destroy'
import { initializeGraphRuntime } from '@/graph/graph/runtime-initialization'
import type { HoverRuntimeState } from '@/graph/graph/hover-runtime'
import type { RuntimeEvent } from '@/graph/graph/runtime-context-owner'
import type { RuntimeFrameLoopController } from '@/graph/graph/runtime-frame-loop-controller'

export interface GraphLifecycleOwner {
  _fitViewOnInitTimeoutID: number | undefined
  _isDestroyed: boolean
  attributionDivElement: HTMLElement | undefined
  canvas: HTMLCanvasElement
  canvasD3Selection: Selection<HTMLCanvasElement, undefined, null, undefined> | undefined
  clusters: Clusters | undefined
  config: GraphConfigInterface
  currentEvent: RuntimeEvent
  device: Device | undefined
  dragInstance: Drag
  forceCenter: ForceCenter | undefined
  forceGravity: ForceGravity | undefined
  forceLinkIncoming: ForceLink | undefined
  forceLinkOutgoing: ForceLink | undefined
  forceManyBody: ForceManyBody | undefined
  forceMouse: ForceMouse | undefined
  fpsMonitor: FPSMonitor | undefined
  graph: GraphData
  hoverState: HoverRuntimeState
  isReady: boolean
  isRightClickMouse: boolean
  lines: Lines | undefined
  msaaTarget: MsaaTarget | undefined
  points: Points | undefined
  shouldDestroyDevice: boolean
  store: Store
  timerQueryPool: ITimerQueryPool | undefined
  zoomInstance: Zoom
  applyEffectivePixelRatio: (ratio: number) => boolean
  frameLoop: RuntimeFrameLoopController
  markRenderDirty: () => void
  setZoomLevel: (value: number) => void
  traceDebugFrame: (name: string, data?: Record<string, unknown>) => void
  updateZoomDragBehaviors: () => void
}

export interface GraphLifecycleState {
  deviceInitPromise: Promise<Device>
  ready: Promise<void>
  shouldDestroyDevice: boolean
}

export function createGraphLifecycle (
  owner: GraphLifecycleOwner,
  div: HTMLDivElement,
  config: GraphConfig | undefined,
  devicePromise: Promise<Device> | undefined,
): GraphLifecycleState {
  if (config) applyConfig(owner.config, config)
  owner.zoomInstance.updateScaleExtent()

  const shouldDestroyDevice = !devicePromise
  const deviceInitPromise = devicePromise ?? createGraphDevice(
    document.createElement('canvas'),
    owner.config,
    sanitizePixelRatio,
  )

  const setupPromise = deviceInitPromise.then(device => {
    if (owner._isDestroyed) {
      if (owner.shouldDestroyDevice) device.destroy()
      return device
    }

    owner.device = device
    owner.isReady = true
    Object.assign(owner, initializeGraphRuntime({
      device,
      div,
      hasExternalDevice: !!devicePromise,
      config: owner.config,
      store: owner.store,
      graph: owner.graph,
      zoomInstance: owner.zoomInstance,
      dragInstance: owner.dragInstance,
      hoverState: owner.hoverState,
      applyEffectivePixelRatio: ratio => { owner.applyEffectivePixelRatio(ratio) },
      sanitizePixelRatio: ratio => sanitizePixelRatio(ratio),
      updateZoomDragBehaviors: () => owner.updateZoomDragBehaviors(),
      setZoomLevel: value => owner.setZoomLevel(value),
      markRenderDirty: () => owner.markRenderDirty(),
      traceDebugFrame: (name, data) => owner.traceDebugFrame(name, data),
      setCurrentEvent: event => { owner.currentEvent = event },
      setRightClickMouse: value => { owner.isRightClickMouse = value },
    }))

    return device
  }).catch(error => {
    owner.device = undefined
    owner.isReady = false
    console.error('Device initialization failed:', error)
    throw error
  })

  return {
    deviceInitPromise,
    ready: setupPromise.then(() => undefined),
    shouldDestroyDevice,
  }
}

export function destroyGraphLifecycle (owner: GraphLifecycleOwner): void {
  if (owner._isDestroyed) return
  owner._isDestroyed = true
  owner.isReady = false
  window.clearTimeout(owner._fitViewOnInitTimeoutID)
  owner.frameLoop.stop()

  destroyGraphRuntime({
    canvasD3Selection: owner.canvasD3Selection,
    zoomInstance: owner.zoomInstance,
    dragInstance: owner.dragInstance,
    fpsMonitor: owner.fpsMonitor,
    timerQueryPool: owner.timerQueryPool,
    modules: [
      owner.points,
      owner.lines,
      owner.clusters,
      owner.forceGravity,
      owner.forceCenter,
      owner.forceManyBody,
      owner.forceLinkIncoming,
      owner.forceLinkOutgoing,
      owner.forceMouse,
    ],
    msaaTarget: owner.msaaTarget,
    device: owner.device,
    shouldDestroyDevice: owner.shouldDestroyDevice,
    store: owner.store,
    canvas: owner.canvas,
    attributionDivElement: owner.attributionDivElement,
  })
  owner.msaaTarget = undefined
  owner.canvasD3Selection = undefined
  owner.attributionDivElement = undefined
}
