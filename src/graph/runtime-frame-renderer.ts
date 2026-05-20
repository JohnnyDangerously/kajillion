import type { Device } from '@luma.gl/core'
import type { D3DragEvent } from 'd3-drag'

import type { GraphConfigInterface } from '@/graph/config'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Lines } from '@/graph/modules/Lines'
import type { Points } from '@/graph/modules/Points'
import type { Hovered, Store } from '@/graph/modules/Store'
import type { NativeZoomEvent, Zoom } from '@/graph/modules/Zoom'
import type { ITimerQueryPool } from '@/graph/perf'
import type { ResolvedRenderPolicy } from '@/graph/render/resolveAdaptiveRenderPolicy'
import type { MsaaTarget } from '@/graph/render/msaa-target'

import {
  prepareRenderPositionInterpolation,
  renderRuntimeCanvasScene,
  resolveRenderPositionInterpolation,
  runPhysicsStep,
  syncPositionStorageBuffer,
} from './runtime-frame-renderer-helpers'
import {
  consumeRenderDirtyFrame,
  shouldSkipIdleFrame,
} from './runtime-render-loop'

export type RuntimeFrameCurrentEvent = NativeZoomEvent | D3DragEvent<HTMLCanvasElement, undefined, Hovered> | MouseEvent | undefined

export interface RuntimeFrameRendererContext {
  isDestroyed: boolean;
  config: GraphConfigInterface;
  graph: GraphData;
  store: Store;
  canvas: HTMLCanvasElement;
  device: Device | undefined;
  points: Points | undefined;
  lines: Lines | undefined;
  zoomInstance: Pick<Zoom, 'isRunning'>;
  isDragActive: boolean;
  timerQueryPool: ITimerQueryPool | undefined;
  msaaTarget: MsaaTarget | undefined;
  isRenderDirty: boolean;
  renderDirtyFrameCount: number;
  currentEvent: RuntimeFrameCurrentEvent;
  lastPhysicsTickMs: number;
  getPositionEpoch: () => number;
  traceDebugFrame: (name: string, data?: Record<string, unknown>) => void;
  maybeApplyAdaptiveDpr: (nowMs: number) => boolean;
  resizeCanvas: (forceResize?: boolean) => void;
  findHoveredItem: () => void;
  beginFpsMonitor: () => void;
  endFpsMonitor: (nowMs: number) => void;
  runSimulationStep: (forceExecution?: boolean) => void;
  resolveRenderPolicy: () => ResolvedRenderPolicy;
  markPointPositionsChanged: () => void;
}

export interface RuntimeFrameRendererState {
  msaaTarget: MsaaTarget | undefined;
  isRenderDirty: boolean;
  renderDirtyFrameCount: number;
  currentEvent: RuntimeFrameCurrentEvent;
  lastPhysicsTickMs: number;
}

export function renderRuntimeFrame (
  context: RuntimeFrameRendererContext,
  now?: number,
): RuntimeFrameRendererState {
  const {
    config,
    store,
    zoomInstance,
    timerQueryPool,
  } = context
  let {
    msaaTarget,
    isRenderDirty,
    renderDirtyFrameCount,
    currentEvent,
    lastPhysicsTickMs,
  } = context

  if (context.isDestroyed) {
    return { msaaTarget, isRenderDirty, renderDirtyFrameCount, currentEvent, lastPhysicsTickMs }
  }
  if (!store.pointsTextureSize) {
    return { msaaTarget, isRenderDirty, renderDirtyFrameCount, currentEvent, lastPhysicsTickMs }
  }
  context.traceDebugFrame('render-enter', { now })

  timerQueryPool?.tick()
  const dprChanged = context.maybeApplyAdaptiveDpr(now ?? performance.now())
  context.resizeCanvas(dprChanged)

  const isIdle = shouldSkipIdleFrame({
    disableIdleFrameSkip: config.disableIdleFrameSkip,
    isSimulationRunning: store.isSimulationRunning,
    currentEvent,
    isZoomRunning: zoomInstance.isRunning,
    isDragActive: context.isDragActive,
    isRenderDirty,
    dprChanged,
  })
  if (isIdle) {
    context.traceDebugFrame('idle-skip', { dprChanged, isSettled: !store.isSimulationRunning })
    return { msaaTarget, isRenderDirty, renderDirtyFrameCount, currentEvent, lastPhysicsTickMs }
  }

  const renderDirtyState = consumeRenderDirtyFrame({
    isRenderDirty,
    renderDirtyFrameCount,
  })
  isRenderDirty = renderDirtyState.isRenderDirty
  renderDirtyFrameCount = renderDirtyState.renderDirtyFrameCount
  context.traceDebugFrame('render-active', { dprChanged, isSettled: !store.isSimulationRunning })

  context.beginFpsMonitor()
  if (!context.isDragActive) {
    context.findHoveredItem()
  }

  const interpolationState = prepareRenderPositionInterpolation(context)
  const simulationState = runPhysicsStep(context, lastPhysicsTickMs, now)
  lastPhysicsTickMs = simulationState.lastPhysicsTickMs
  resolveRenderPositionInterpolation(
    context,
    interpolationState.shouldCaptureRenderPositionsNow,
    simulationState.simulationAdvanced,
    interpolationState.forceThrottleAlpha,
  )
  syncPositionStorageBuffer(context)
  msaaTarget = renderRuntimeCanvasScene(context, msaaTarget)

  context.endFpsMonitor(now ?? performance.now())
  currentEvent = undefined
  context.traceDebugFrame('render-exit')

  return { msaaTarget, isRenderDirty, renderDirtyFrameCount, currentEvent: undefined, lastPhysicsTickMs }
}
