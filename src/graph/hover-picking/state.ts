import type { GraphConfigInterface } from '@/graph/config'
import type { Store } from '@/graph/modules/Store'
import type { HoverChange, HoverDetectionResult, LinkHoverPathCache } from './types'

export const emptyHoverChange = (): HoverChange => ({ mouseover: false, mouseout: false })

export const emptyHoverDetectionResult = (): HoverDetectionResult => ({
  point: emptyHoverChange(),
  link: emptyHoverChange(),
})

export function createLinkHoverPathCache (): LinkHoverPathCache {
  return {
    tValues: undefined,
    tValuesSegments: -1,
  }
}

export function isPointHoveringEnabled (config: GraphConfigInterface): boolean {
  return !!(
    config.enableDrag ||
    config.renderHoveredPointRing ||
    config.onPointClick ||
    config.onPointContextMenu ||
    config.onPointMouseOver ||
    config.onPointMouseOut
  )
}

export function shouldCheckHoverForMousePosition (
  forceHoverDetection: boolean,
  lastMouseX: number,
  lastMouseY: number,
  lastCheckedMouseX: number,
  lastCheckedMouseY: number,
  minMouseMovementThreshold: number
): boolean {
  if (forceHoverDetection) return true
  const deltaX = Math.abs(lastMouseX - lastCheckedMouseX)
  const deltaY = Math.abs(lastMouseY - lastCheckedMouseY)
  return deltaX > minMouseMovementThreshold || deltaY > minMouseMovementThreshold
}

export function updateHoveredPointFromFramebufferPixels (
  store: Store,
  pixels: Float32Array | Uint8Array | Uint8ClampedArray
): HoverChange {
  const hoveredIndex = pixels[0] as number
  const pointSize = pixels[1] as number
  const pointX = pixels[2] as number
  const pointY = pixels[3] as number

  if (pointSize > 0) return setHoveredPoint(store, hoveredIndex, pointX, pointY)
  return clearHoveredPoint(store)
}

export function updateHoveredLinkIndex (store: Store, hoveredLinkIndex: number): HoverChange {
  if (hoveredLinkIndex >= 0) return setHoveredLink(store, hoveredLinkIndex)
  return clearHoveredLink(store)
}

export function clearHoveredLink (store: Store): HoverChange {
  const mouseout = store.hoveredLinkIndex !== undefined
  store.hoveredLinkIndex = undefined
  return { mouseover: false, mouseout }
}

export function clearHoveredPoint (store: Store): HoverChange {
  const mouseout = store.hoveredPoint !== undefined
  store.hoveredPoint = undefined
  return { mouseover: false, mouseout }
}

export function setHoveredPoint (store: Store, index: number, x: number, y: number): HoverChange {
  const mouseover = store.hoveredPoint === undefined || store.hoveredPoint.index !== index
  store.hoveredPoint = {
    index,
    position: [x, y],
  }
  return { mouseover, mouseout: false }
}

export function setHoveredLink (store: Store, index: number): HoverChange {
  const mouseover = store.hoveredLinkIndex !== index
  store.hoveredLinkIndex = index
  return { mouseover, mouseout: false }
}
