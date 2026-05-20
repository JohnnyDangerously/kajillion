import type { Device } from '@luma.gl/core'
import type { Selection } from 'd3-selection'

import type { GraphConfigInterface } from '@/graph/config'
import { getMaxPointSize } from '@/graph/helper'
import type { Lines } from '@/graph/modules/Lines'
import type { Points } from '@/graph/modules/Points'
import type { Store } from '@/graph/modules/Store'
import type { Drag } from '@/graph/modules/Drag'
import type { Zoom } from '@/graph/modules/Zoom'
import { resolveAdaptiveDprDecision, sanitizePixelRatio } from '@/graph/graph/adaptive-dpr'

export interface RuntimeCanvasContext {
  isDestroyed: () => boolean
  config: GraphConfigInterface
  store: Store
  canvas: HTMLCanvasElement
  device: Device | undefined
  points: Points | undefined
  lines: Lines | undefined
  zoomInstance: Zoom
  dragInstance: Drag
  canvasD3Selection: Selection<HTMLCanvasElement, undefined, null, undefined> | undefined
  lastAppliedDpr: number | undefined
  lastInteractionMs: number
  lastAdaptiveTransformX: number
  lastAdaptiveTransformY: number
  lastAdaptiveTransformK: number
  setAdaptiveState: (state: Partial<RuntimeCanvasAdaptiveState>) => void
  traceDebugFrame: (name: string, data?: Record<string, unknown>) => void
}

export interface RuntimeCanvasAdaptiveState {
  lastAppliedDpr: number | undefined
  lastInteractionMs: number
  lastAdaptiveTransformX: number
  lastAdaptiveTransformY: number
  lastAdaptiveTransformK: number
}

export function applyRuntimeEffectivePixelRatio (context: RuntimeCanvasContext, ratio: number): boolean {
  const effectiveRatio = sanitizePixelRatio(ratio)
  if (context.lastAppliedDpr === effectiveRatio && context.store.effectivePixelRatio === effectiveRatio) {
    return false
  }
  context.setAdaptiveState({ lastAppliedDpr: effectiveRatio })
  context.store.effectivePixelRatio = effectiveRatio
  if (context.device?.canvasContext) {
    context.device.canvasContext.setProps({ useDevicePixels: effectiveRatio })
    context.store.maxPointSize = getMaxPointSize(context.device, effectiveRatio)
  }
  return true
}

export function maybeApplyRuntimeAdaptiveDpr (context: RuntimeCanvasContext, nowMs: number): boolean {
  if (!context.device?.canvasContext) return false
  const setting = context.config.adaptivePixelRatio
  if (!setting) return false
  const { x, y, k } = context.zoomInstance.eventTransform
  const decision = resolveAdaptiveDprDecision({
    nowMs,
    setting,
    configuredPixelRatio: context.config.pixelRatio,
    transform: { x, y, k },
    previousTransform: {
      x: context.lastAdaptiveTransformX,
      y: context.lastAdaptiveTransformY,
      k: context.lastAdaptiveTransformK,
    },
    isDragActive: context.dragInstance.isActive,
    isZoomRunning: context.zoomInstance.isRunning,
    isSimulationRunning: context.store.isSimulationRunning,
    lastInteractionMs: context.lastInteractionMs,
    settleMs: context.config.adaptivePixelRatioSettleMs ?? 150,
  })
  context.setAdaptiveState({
    lastAdaptiveTransformX: x,
    lastAdaptiveTransformY: y,
    lastAdaptiveTransformK: k,
    lastInteractionMs: decision.lastInteractionMs,
  })
  const changed = applyRuntimeEffectivePixelRatio(context, decision.desired)
  if (!changed) return false
  context.traceDebugFrame('dpr-change', {
    desired: decision.desired,
    fullDpr: decision.fullDpr,
    interactionDpr: decision.interactionDpr,
    settled: decision.settled,
    cameraMoved: decision.cameraMoved,
    nowMs,
    lastInteractionMs: decision.lastInteractionMs,
  })
  return true
}

export function resizeRuntimeCanvas (context: RuntimeCanvasContext, forceResize = false): void {
  if (context.isDestroyed()) return
  const w = context.canvas.clientWidth
  const h = context.canvas.clientHeight
  const [prevW, prevH] = context.store.screenSize
  if (forceResize || prevW !== w || prevH !== h) {
    const { k } = context.zoomInstance.eventTransform
    const centerPosition = context.zoomInstance.convertScreenToSpacePosition([prevW / 2, prevH / 2])
    context.traceDebugFrame('resize', { forceResize, prevW, prevH, w, h, centerX: centerPosition[0], centerY: centerPosition[1], k })
    context.store.updateScreenSize(w, h)
    context.zoomInstance.updateTranslateExtent()
    const nextTransform = context.zoomInstance.constrainTransform(context.zoomInstance.getTransform(centerPosition, k))
    context.zoomInstance.setTransform(nextTransform, 0)
    context.points?.updateSampledPointsGrid()
    context.lines?.updateSampledLinksGrid()
    if (context.store.isLinkHoveringEnabled) context.lines?.updateLinkIndexFbo()
  }
}

export function updateRuntimeZoomDragBehaviors (context: RuntimeCanvasContext): void {
  if (context.config.enableDrag) {
    context.canvasD3Selection?.call(context.dragInstance.behavior)
  } else {
    context.canvasD3Selection
      ?.call(context.dragInstance.behavior)
      .on('.drag', null)
  }

  if (context.config.enableZoom) {
    if (context.canvas) context.zoomInstance.attach(context.canvas)
  } else {
    context.zoomInstance.detach()
  }
}
