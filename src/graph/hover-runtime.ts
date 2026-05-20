import type { HoverRuntimeContext, HoverRuntimeState } from '@/graph/graph/hover-runtime/contracts'
import { MAX_HOVER_DETECTION_DELAY, MIN_MOUSE_MOVEMENT_THRESHOLD } from '@/graph/modules/Store'
import {
  clearHoveredLink,
  clearHoveredPoint,
  isPointHoveringEnabled,
} from '@/graph/graph/hover-picking'
import { findHoveredItemOnCpu, findHoveredItemOnGpu } from '@/graph/graph/hover-runtime/picking'
import { updateGraphCanvasCursor } from '@/graph/graph/runtime-event-actions'

export type { HoverRuntimeContext, HoverRuntimeEvent, HoverRuntimeState } from '@/graph/graph/hover-runtime/contracts'

export function createHoverRuntimeState (): HoverRuntimeState {
  return {
    findHoveredItemExecutionCount: 0,
    isMouseOnCanvas: false,
    lastMouseX: 0,
    lastMouseY: 0,
    lastCheckedMouseX: 0,
    lastCheckedMouseY: 0,
    shouldForceHoverDetection: false,
  }
}

export function shouldCheckHoverRuntimeForCurrentMousePosition (state: HoverRuntimeState): boolean {
  if (state.shouldForceHoverDetection) return true
  const deltaX = Math.abs(state.lastMouseX - state.lastCheckedMouseX)
  const deltaY = Math.abs(state.lastMouseY - state.lastCheckedMouseY)
  return deltaX > MIN_MOUSE_MOVEMENT_THRESHOLD || deltaY > MIN_MOUSE_MOVEMENT_THRESHOLD
}

export function runHoverDetection (context: HoverRuntimeContext): void {
  const { config, hoverState, store } = context
  if (context.isDestroyed || !hoverState.isMouseOnCanvas) return

  const pointHoveringEnabled = isPointHoveringEnabled(config)
  if (!pointHoveringEnabled && !store.isLinkHoveringEnabled) {
    clearHoveredPoint(store)
    clearHoveredLink(store)
    return
  }
  if (hoverState.findHoveredItemExecutionCount < MAX_HOVER_DETECTION_DELAY) {
    hoverState.findHoveredItemExecutionCount += 1
    return
  }

  if (!shouldCheckHoverRuntimeForCurrentMousePosition(hoverState)) return

  hoverState.lastCheckedMouseX = hoverState.lastMouseX
  hoverState.lastCheckedMouseY = hoverState.lastMouseY
  hoverState.shouldForceHoverDetection = false
  hoverState.findHoveredItemExecutionCount = 0

  // Two-phase hover detection: first update state, then fire callbacks.
  // This guarantees mouseout fires before mouseover when transitioning
  // between element types (e.g. link -> point).
  const { point, link } = context.device?.info?.type === 'webgpu'
    ? findHoveredItemOnGpu(context)
    : findHoveredItemOnCpu(context)

  if (point.mouseout) config.onPointMouseOut?.(context.currentEvent)
  if (link.mouseout) config.onLinkMouseOut?.(context.currentEvent)

  if (point.mouseover && store.hoveredPoint) {
    const idx = store.hoveredPoint.index
    config.onPointMouseOver?.(
      store.hoveredPoint.index,
      store.hoveredPoint.position,
      context.currentEvent,
      store.highlightedPointSet?.has(idx) ?? false,
      store.outlinedPointSet?.has(idx) ?? false
    )
  }
  if (link.mouseover && store.hoveredLinkIndex !== undefined) {
    config.onLinkMouseOver?.(store.hoveredLinkIndex)
  }

  updateGraphCanvasCursor(context.canvas, config, store, context.isDragActive)
}
