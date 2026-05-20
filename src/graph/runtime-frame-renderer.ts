import type {
  RuntimeFrameRendererContext,
  RuntimeFrameRendererState,
} from '@/graph/graph/runtime-frame-renderer-contracts'

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

export type {
  RuntimeFrameCurrentEvent,
  RuntimeFrameRendererContext,
  RuntimeFrameRendererState,
} from '@/graph/graph/runtime-frame-renderer-contracts'

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
