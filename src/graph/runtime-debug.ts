import { type D3DragEvent } from 'd3-drag'

import { type Drag } from '@/graph/modules/Drag'
import { type Hovered, type Store } from '@/graph/modules/Store'
import { type NativeZoomEvent, type Zoom } from '@/graph/modules/Zoom'

import {
  appendBoundedDebugFrameTraceEvent,
  createDebugFrameTraceEvent,
} from './debug-frame-trace'
import { type DebugFrameTraceEvent } from './runtime-contracts'

type GraphRuntimeEvent = NativeZoomEvent | D3DragEvent<HTMLCanvasElement, undefined, Hovered> | MouseEvent

export interface TraceRuntimeDebugFrameOptions {
  enabled: boolean
  trace: DebugFrameTraceEvent[]
  limit: number
  name: string
  data?: Record<string, unknown>
  rafCallbackCount: number
  renderedFrameCount: number
  skippedFrameCount: number
  isRenderDirty: boolean
  renderDirtyFrameCount: number
  currentEvent: GraphRuntimeEvent | undefined
  store: Store
  zoomInstance: Zoom
  dragInstance: Drag
  canvas: HTMLCanvasElement | undefined
}

export function traceRuntimeDebugFrame ({
  enabled,
  trace,
  limit,
  name,
  data,
  rafCallbackCount,
  renderedFrameCount,
  skippedFrameCount,
  isRenderDirty,
  renderDirtyFrameCount,
  currentEvent,
  store,
  zoomInstance,
  dragInstance,
  canvas,
}: TraceRuntimeDebugFrameOptions): void {
  if (!enabled) return
  const { x, y, k } = zoomInstance.eventTransform
  appendBoundedDebugFrameTraceEvent(trace, createDebugFrameTraceEvent({
    name,
    raf: rafCallbackCount,
    rendered: renderedFrameCount,
    skipped: skippedFrameCount,
    alpha: store.alpha,
    sim: store.isSimulationRunning,
    zoom: zoomInstance.isRunning,
    drag: dragInstance.isActive,
    dirty: isRenderDirty,
    dirtyFrames: renderDirtyFrameCount,
    event: currentEvent,
    camera: { x, y, k },
    screen: [...store.screenSize] as [number, number],
    canvas,
    data,
  }), limit)
}
