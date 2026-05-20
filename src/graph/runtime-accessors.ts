import { type GraphData } from '@/graph/modules/GraphData'
import { type Lines } from '@/graph/modules/Lines'
import { type Points } from '@/graph/modules/Points'
import { type Zoom } from '@/graph/modules/Zoom'

export interface GraphAccessorContext {
  isDestroyed: boolean
  graph: GraphData
  points: Points | undefined
  lines: Lines | undefined
  zoomInstance: Zoom
}

export function spaceToScreenPosition (
  context: GraphAccessorContext,
  spacePosition: [number, number]
): [number, number] {
  if (context.isDestroyed) return [0, 0]
  return context.zoomInstance.convertSpaceToScreenPosition(spacePosition)
}

export function screenToSpacePosition (
  context: GraphAccessorContext,
  screenPosition: [number, number]
): [number, number] {
  if (context.isDestroyed) return [0, 0]
  return context.zoomInstance.convertScreenToSpacePosition(screenPosition)
}

export function spaceToScreenRadius (
  context: GraphAccessorContext,
  spaceRadius: number
): number {
  if (context.isDestroyed) return 0
  return context.zoomInstance.convertSpaceToScreenRadius(spaceRadius)
}

export function getPointRadiusByIndex (
  context: GraphAccessorContext,
  index: number
): number | undefined {
  if (context.isDestroyed) return undefined
  const shapeSize = context.graph.pointSizes?.[index]
  const imageSize = context.graph.pointImageSizes?.[index]
  if (shapeSize === undefined && imageSize === undefined) return undefined
  return Math.max(shapeSize ?? 0, imageSize ?? 0)
}

export function getTrackedPointPositionsMap (
  context: GraphAccessorContext
): ReadonlyMap<number, [number, number]> {
  if (context.isDestroyed || !context.points) return new Map()
  return context.points.getTrackedPositionsMap()
}

export function getTrackedPointPositionsArray (
  context: GraphAccessorContext
): number[] {
  if (context.isDestroyed || !context.points) return []
  return context.points.getTrackedPositionsArray()
}

export function getSampledPointPositionsMap (
  context: GraphAccessorContext
): Map<number, [number, number]> {
  if (context.isDestroyed || !context.points) return new Map()
  return context.points.getSampledPointPositionsMap()
}

export function getSampledPoints (
  context: GraphAccessorContext
): { indices: number[]; positions: number[] } {
  if (context.isDestroyed || !context.points) return { indices: [], positions: [] }
  return context.points.getSampledPoints()
}

export function getSampledLinkPositionsMap (
  context: GraphAccessorContext
): Map<number, [number, number, number]> {
  if (context.isDestroyed || !context.lines) return new Map()
  return context.lines.getSampledLinkPositionsMap()
}

export function getSampledLinks (
  context: GraphAccessorContext
): { indices: number[]; positions: number[]; angles: number[] } {
  if (context.isDestroyed || !context.lines) return { indices: [], positions: [], angles: [] }
  return context.lines.getSampledLinks()
}

export function getScaleX (
  context: GraphAccessorContext
): ((x: number) => number) | undefined {
  if (context.isDestroyed || !context.points) return undefined
  return context.points.scaleX
}

export function getScaleY (
  context: GraphAccessorContext
): ((y: number) => number) | undefined {
  if (context.isDestroyed || !context.points) return undefined
  return context.points.scaleY
}
