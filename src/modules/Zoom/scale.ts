import { type GraphConfigInterface } from '@/graph/config/schema'
import { clamp } from '@/graph/helper'
import { NativeZoomTransform } from './native'

export function getMinZoomLevel (config: GraphConfigInterface): number {
  return Math.max(0.001, Number.isFinite(config.minZoomLevel) ? config.minZoomLevel : 0.001)
}

export function getMaxZoomLevel (config: GraphConfigInterface): number {
  const minZoom = getMinZoomLevel(config)
  const maxZoom = config.maxZoomLevel
  if (maxZoom === Infinity) return Infinity
  return Math.max(minZoom, Number.isFinite(maxZoom) ? maxZoom : Infinity)
}

export function getFiniteMaxZoomLevel (config: GraphConfigInterface): number {
  const minZoom = getMinZoomLevel(config)
  const maxZoom = getMaxZoomLevel(config)
  if (Number.isFinite(maxZoom)) return Math.max(minZoom, maxZoom)
  return minZoom * 1000
}

export function zoomLevelToDistance (
  zoomLevel: number,
  minZoom: number,
  maxZoom: number
): number {
  const safeZoom = clamp(Math.max(zoomLevel, 0.001), minZoom, maxZoom)
  const minLog = Math.log(minZoom)
  const maxLog = Math.log(maxZoom)
  if (maxLog <= minLog) return 100
  const t = (Math.log(safeZoom) - minLog) / (maxLog - minLog)
  return 100 - clamp(t, 0, 1) * 99
}

export function zoomDistanceToLevel (
  distance: number,
  minZoom: number,
  maxZoom: number
): number {
  const t = clamp((100 - distance) / 99, 0, 1)
  const minLog = Math.log(minZoom)
  const maxLog = Math.log(maxZoom)
  return Math.exp(minLog + t * (maxLog - minLog))
}

export function constrainAxis (
  translate: number,
  k: number,
  min: number,
  max: number,
  viewportSize: number
): number {
  const lo = viewportSize - max * k
  const hi = -min * k
  if (lo > hi) return (lo + hi) / 2
  return clamp(translate, lo, hi)
}

export function scaleAround (
  current: NativeZoomTransform,
  anchorX: number,
  anchorY: number,
  zoomLevel: number,
  minZoom: number,
  maxZoom: number
): NativeZoomTransform {
  const nextK = clamp(zoomLevel, minZoom, maxZoom)
  if (nextK === current.k) return current
  const ratio = nextK / current.k
  return new NativeZoomTransform(
    anchorX - (anchorX - current.x) * ratio,
    anchorY - (anchorY - current.y) * ratio,
    nextK
  )
}
