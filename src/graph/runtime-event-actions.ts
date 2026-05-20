import { select } from 'd3-selection'
import { type D3DragEvent } from 'd3-drag'

import { type GraphConfigInterface } from '@/graph/config'
import { type Hovered, type Store } from '@/graph/modules/Store'
import { type Zoom } from '@/graph/modules/Zoom'
import { shouldCheckHoverForMousePosition } from './hover-picking'

export interface GraphEventActionContext {
  config: GraphConfigInterface
  store: Store
}

export function handleGraphClick (
  { config, store }: GraphEventActionContext,
  event: MouseEvent
): void {
  config.onClick?.(
    store.hoveredPoint?.index,
    store.hoveredPoint?.position,
    event
  )

  if (store.hoveredPoint) {
    config.onPointClick?.(
      store.hoveredPoint.index,
      store.hoveredPoint.position,
      event
    )
  } else if (store.hoveredLinkIndex !== undefined) {
    config.onLinkClick?.(
      store.hoveredLinkIndex,
      event
    )
  } else {
    config.onBackgroundClick?.(
      event
    )
  }
}

export function updateGraphMousePosition (
  store: Store,
  zoomInstance: Zoom,
  event: MouseEvent | D3DragEvent<HTMLCanvasElement, undefined, Hovered>
): void {
  const mouseX = (event as MouseEvent).offsetX ?? (event as D3DragEvent<HTMLCanvasElement, undefined, Hovered>).x
  const mouseY = (event as MouseEvent).offsetY ?? (event as D3DragEvent<HTMLCanvasElement, undefined, Hovered>).y
  if (mouseX === undefined || mouseY === undefined) return
  store.mousePosition = zoomInstance.convertScreenToSpacePosition([mouseX, mouseY])
  store.screenMousePosition = [mouseX, (store.screenSize[1] - mouseY)]
}

export function handleGraphMouseMove (
  { config, store }: GraphEventActionContext,
  currentEvent: MouseEvent
): void {
  config.onMouseMove?.(
    store.hoveredPoint?.index,
    store.hoveredPoint?.position,
    currentEvent
  )
}

export function handleGraphContextMenu (
  { config, store }: GraphEventActionContext,
  event: MouseEvent
): void {
  event.preventDefault()

  config.onContextMenu?.(
    store.hoveredPoint?.index,
    store.hoveredPoint?.position,
    event
  )

  if (store.hoveredPoint) {
    config.onPointContextMenu?.(
      store.hoveredPoint.index,
      store.hoveredPoint.position,
      event
    )
  } else if (store.hoveredLinkIndex !== undefined) {
    config.onLinkContextMenu?.(
      store.hoveredLinkIndex,
      event
    )
  } else {
    config.onBackgroundContextMenu?.(
      event
    )
  }
}

export function updateGraphCanvasCursor (
  canvas: HTMLCanvasElement,
  config: GraphConfigInterface,
  store: Store,
  isDragActive: boolean
): void {
  const { hoveredPointCursor, hoveredLinkCursor } = config
  if (isDragActive) select(canvas).style('cursor', 'grabbing')
  else if (store.hoveredPoint) {
    if (!config.enableDrag || store.isSpaceKeyPressed) select(canvas).style('cursor', hoveredPointCursor)
    else select(canvas).style('cursor', 'grab')
  } else if (store.isLinkHoveringEnabled && store.hoveredLinkIndex !== undefined) {
    select(canvas).style('cursor', hoveredLinkCursor)
  } else select(canvas).style('cursor', null)
}

export function shouldCheckGraphHoverForMousePosition (
  shouldForceHoverDetection: boolean,
  lastMouseX: number,
  lastMouseY: number,
  lastCheckedMouseX: number,
  lastCheckedMouseY: number,
  minMouseMovementThreshold: number
): boolean {
  return shouldCheckHoverForMousePosition(
    shouldForceHoverDetection,
    lastMouseX,
    lastMouseY,
    lastCheckedMouseX,
    lastCheckedMouseY,
    minMouseMovementThreshold
  )
}
