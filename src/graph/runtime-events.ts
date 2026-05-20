import { select, type Selection } from 'd3-selection'
import { type D3DragEvent } from 'd3-drag'

import { type GraphConfigInterface } from '@/graph/config'
import { type Drag } from '@/graph/modules/Drag'
import { type Hovered, type Store } from '@/graph/modules/Store'
import { type NativeZoomEvent, type Zoom } from '@/graph/modules/Zoom'

type GraphInputEvent = NativeZoomEvent | D3DragEvent<HTMLCanvasElement, undefined, Hovered> | MouseEvent

export interface GraphEventHandlersOptions {
  canvas: HTMLCanvasElement
  config: GraphConfigInterface
  store: Store
  zoomInstance: Zoom
  dragInstance: Drag
  markRenderDirty: () => void
  traceDebugFrame: (name: string, data?: Record<string, unknown>) => void
  shouldCheckHoverForCurrentMousePosition: () => boolean
  updateCanvasCursor: () => void
  updateMousePosition: (event: MouseEvent | D3DragEvent<HTMLCanvasElement, undefined, Hovered>) => void
  onClick: (event: MouseEvent) => void
  onMouseMove: (event: MouseEvent) => void
  onContextMenu: (event: MouseEvent) => void
  setMouseOnCanvas: (value: boolean) => void
  setLastMousePosition: (x: number, y: number) => void
  setCurrentEvent: (event: GraphInputEvent) => void
  setRightClickMouse: (value: boolean) => void
  forceHoverDetection: () => void
}

export function setupGraphEventHandlers ({
  canvas,
  config,
  store,
  zoomInstance,
  dragInstance,
  markRenderDirty,
  traceDebugFrame,
  shouldCheckHoverForCurrentMousePosition,
  updateCanvasCursor,
  updateMousePosition,
  onClick,
  onMouseMove,
  onContextMenu,
  setMouseOnCanvas,
  setLastMousePosition,
  setCurrentEvent,
  setRightClickMouse,
  forceHoverDetection,
}: GraphEventHandlersOptions): Selection<HTMLCanvasElement, undefined, null, undefined> {
  const canvasD3Selection = select<HTMLCanvasElement, undefined>(canvas)
  canvasD3Selection
    .on('mouseenter.cosmos', (event) => {
      setMouseOnCanvas(true)
      setLastMousePosition(event.clientX, event.clientY)
      markRenderDirty()
      traceDebugFrame('mouse-enter', { x: event.clientX, y: event.clientY })
    })
    .on('mousemove.cosmos', (event) => {
      setMouseOnCanvas(true)
      setLastMousePosition(event.clientX, event.clientY)
      if (shouldCheckHoverForCurrentMousePosition()) {
        markRenderDirty()
      }
    })
    .on('mouseleave.cosmos', (event) => {
      setMouseOnCanvas(false)
      setCurrentEvent(event)
      markRenderDirty()
      traceDebugFrame('mouse-leave', { x: event.clientX, y: event.clientY })

      if (store.hoveredPoint !== undefined && config.onPointMouseOut) {
        config.onPointMouseOut(event)
      }
      if (store.hoveredLinkIndex !== undefined && config.onLinkMouseOut) {
        config.onLinkMouseOut(event)
      }

      setRightClickMouse(false)
      store.hoveredPoint = undefined
      store.hoveredLinkIndex = undefined
      updateCanvasCursor()
    })

  select(document)
    .on('keydown.cosmos', (event) => { if (event.code === 'Space') store.isSpaceKeyPressed = true })
    .on('keyup.cosmos', (event) => { if (event.code === 'Space') store.isSpaceKeyPressed = false })

  zoomInstance.onStart = (event: NativeZoomEvent) => {
    setCurrentEvent(event)
    markRenderDirty()
    traceDebugFrame('zoom-start')
  }
  zoomInstance.onZoom = (event: NativeZoomEvent) => {
    const userDriven = !!event.sourceEvent
    if (userDriven && event.sourceEvent instanceof MouseEvent) updateMousePosition(event.sourceEvent)
    setCurrentEvent(event)
    markRenderDirty()
    traceDebugFrame('zoom', { userDriven })
  }
  zoomInstance.onEnd = (event: NativeZoomEvent) => {
    setCurrentEvent(event)
    markRenderDirty()
    traceDebugFrame('zoom-end')
    forceHoverDetection()
  }

  dragInstance.behavior
    .on('start.detect', (event: D3DragEvent<HTMLCanvasElement, undefined, Hovered>) => {
      setCurrentEvent(event)
      markRenderDirty()
      traceDebugFrame('drag-start')
      updateCanvasCursor()
    })
    .on('drag.detect', (event: D3DragEvent<HTMLCanvasElement, undefined, Hovered>) => {
      if (dragInstance.isActive) {
        updateMousePosition(event)
      }
      setCurrentEvent(event)
      markRenderDirty()
      traceDebugFrame('drag')
    })
    .on('end.detect', (event: D3DragEvent<HTMLCanvasElement, undefined, Hovered>) => {
      setCurrentEvent(event)
      markRenderDirty()
      traceDebugFrame('drag-end')
      updateCanvasCursor()
    })

  canvasD3Selection
    .call(dragInstance.behavior)
    .on('click', onClick)
    .on('mousemove', onMouseMove)
    .on('contextmenu', onContextMenu)

  zoomInstance.attach(canvas)
  return canvasD3Selection
}
