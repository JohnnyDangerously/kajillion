import { renderCanvasScene } from '@/graph/render/render-canvas-scene'
import type { MsaaTarget } from '@/graph/render/msaa-target'
import type { RuntimeFrameRendererContext } from '@/graph/graph/runtime-frame-renderer-contracts'

import {
  getForceThrottleAlpha,
  shouldCaptureRenderPositions,
} from './runtime-render-loop'

export interface RenderPositionInterpolationState {
  shouldCaptureRenderPositionsNow: boolean
  forceThrottleAlpha: number
}

export interface SimulationStepState {
  lastPhysicsTickMs: number
  simulationAdvanced: boolean
}

export function prepareRenderPositionInterpolation (
  context: RuntimeFrameRendererContext,
): RenderPositionInterpolationState {
  const { device, graph, points, store, timerQueryPool } = context
  const pointCount = graph.pointsNumber ?? 0
  const forceThrottleAlpha = getForceThrottleAlpha(pointCount)
  const shouldCaptureRenderPositionsNow = shouldCaptureRenderPositions({
    isWebGPU: device?.info?.type === 'webgpu',
    isSimulationRunning: store.isSimulationRunning,
    alpha: store.alpha,
    pointCount,
    hasPositionStorageBuffer: !!points?.positionStorageBuffer,
    hasPreviousRenderPositionStorageBuffer: !!points?.previousRenderPositionStorageBuffer,
  })

  if (shouldCaptureRenderPositionsNow) {
    syncPositionStorageBuffer(context)
    timerQueryPool?.begin('sync.position-prev')
    points?.captureRenderPreviousPositions()
    timerQueryPool?.end()
  } else {
    points?.setRenderPositionInterpolation(1)
  }

  return { shouldCaptureRenderPositionsNow, forceThrottleAlpha }
}

export function runPhysicsStep (
  context: RuntimeFrameRendererContext,
  lastPhysicsTickMs: number,
  now?: number,
): SimulationStepState {
  const { config } = context
  const rawTickRate = config.physicsTickRate
  const tickRate = Number.isFinite(rawTickRate) ? rawTickRate : 0
  const positionEpochBeforeSimulation = context.getPositionEpoch()

  if (tickRate <= 0) {
    context.runSimulationStep(false)
  } else {
    const nowMs = now ?? performance.now()
    const physicsInterval = 1000 / tickRate
    if (nowMs - lastPhysicsTickMs >= physicsInterval) {
      lastPhysicsTickMs = nowMs
      context.runSimulationStep(false)
    }
  }

  return {
    lastPhysicsTickMs,
    simulationAdvanced: context.getPositionEpoch() !== positionEpochBeforeSimulation,
  }
}

export function resolveRenderPositionInterpolation (
  context: RuntimeFrameRendererContext,
  shouldCaptureRenderPositionsNow: boolean,
  simulationAdvanced: boolean,
  forceThrottleAlpha: number,
): void {
  if (!shouldCaptureRenderPositionsNow) {
    return
  }
  const shouldInterpolateTailStep =
    simulationAdvanced &&
    context.store.isSimulationRunning &&
    context.store.alpha < forceThrottleAlpha
  context.points?.setRenderPositionInterpolation(shouldInterpolateTailStep ? 0.5 : 1)
}

export function syncPositionStorageBuffer (context: RuntimeFrameRendererContext): void {
  const { points, timerQueryPool } = context
  if (!points?.isPositionStorageBufferDirty) {
    return
  }
  timerQueryPool?.begin('sync.position-storage')
  points.syncPositionStorageBuffer()
  timerQueryPool?.end()
}

export function renderRuntimeCanvasScene (
  context: RuntimeFrameRendererContext,
  msaaTarget: MsaaTarget | undefined,
): MsaaTarget | undefined {
  const { canvas, config, device, graph, lines, points, store, timerQueryPool } = context
  if (!device) {
    return msaaTarget
  }

  const backgroundColor = store.backgroundColor ?? [0, 0, 0, 1]
  const canvasFramebuffer = device.canvasContext?.getCurrentFramebuffer({ depthStencilFormat: false })
  const shouldDrawLinks =
    config.renderLinks !== false &&
    !!store.linksTextureSize &&
    !!graph.linksNumber &&
    graph.linksNumber > 0
  const renderPolicy = context.resolveRenderPolicy()

  const canvasSceneResult = renderCanvasScene({
    device,
    canvasFramebuffer,
    timerQueryPool,
    msaaTarget,
    backgroundColor,
    shouldDrawLinks,
    isWebGPU: device.info?.type === 'webgpu',
    msaaSamples: config.msaa,
    renderPolicy,
    positionEpoch: context.getPositionEpoch(),
    impostorExactOverlay: config.impostorExactOverlay,
    lines,
    points,
    onPrepared: preparedState => {
      context.traceDebugFrame('render-pass-ready', {
        ...preparedState,
        renderPolicy,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
      })
    },
  })

  if (context.isDragActive) {
    points?.swapFbo()
    points?.drag()
    points?.trackPoints()
    context.markPointPositionsChanged()
  }

  device.submit()
  context.traceDebugFrame('submit')
  return canvasSceneResult.msaaTarget
}
