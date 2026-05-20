import { type Device, type Framebuffer } from '@luma.gl/core'

import {
  extractIndicesFromPixels,
  readPixels,
  readRgba32FloatFramebufferAsync,
} from '@/graph/helper'
import { type GraphData } from '@/graph/modules/GraphData'
import { type Points } from '@/graph/modules/Points'
import { type Store } from '@/graph/modules/Store'
import { type Zoom } from '@/graph/modules/Zoom'

import {
  findPointsInPolygonOnCpu as findPointsInPolygonOnCpuImpl,
  findPointsInRectOnCpu as findPointsInRectOnCpuImpl,
} from './cpu-selection'

export interface RuntimeSelectionContext {
  isDestroyed: () => boolean
  isReady: () => boolean
  ready: Promise<void>
  getDevice: () => Device | undefined
  graph: GraphData
  getPoints: () => Points | undefined
  store: Store
  zoomInstance: Zoom
  getBestKnownWebGpuPointPositions: () => Float32Array | undefined
}

export function findPointsInRect (
  context: RuntimeSelectionContext,
  rect: [[number, number], [number, number]]
): number[] {
  if (context.isDestroyed()) return []
  const device = context.getDevice()
  const points = context.getPoints()
  if (!context.isReady() || !device || !points) return []
  if (device.info?.type === 'webgpu') return findPointsInRectOnCpu(context, rect)

  const h = context.store.screenSize[1]
  context.store.searchArea = [[rect[0][0], (h - rect[1][1])], [rect[1][0], (h - rect[0][1])]]
  if (!points.findPointsInRect()) return []
  return extractIndicesFromPixels(readPixels(device, points.searchFbo as Framebuffer))
}

export async function findPointsInRectAsync (
  context: RuntimeSelectionContext,
  rect: [[number, number], [number, number]]
): Promise<number[]> {
  if (context.isDestroyed()) return []
  if (!context.isReady()) await context.ready
  const device = context.getDevice()
  const points = context.getPoints()
  if (context.isDestroyed() || !device || !points) return []
  if (device.info?.type !== 'webgpu') return findPointsInRect(context, rect)

  const h = context.store.screenSize[1]
  context.store.searchArea = [[rect[0][0], (h - rect[1][1])], [rect[1][0], (h - rect[0][1])]]
  if (!points.findPointsInRect() || !points.searchFbo) return []
  device.submit()
  const pixels = await readRgba32FloatFramebufferAsync(device, points.searchFbo)
  return extractIndicesFromPixels(pixels)
}

export function findPointsInPolygon (
  context: RuntimeSelectionContext,
  polygonPath: [number, number][]
): number[] {
  if (context.isDestroyed()) return []
  const device = context.getDevice()
  const points = context.getPoints()
  if (!context.isReady() || !device || !points) return []

  if (polygonPath.length < 3) {
    console.warn('Polygon path requires at least 3 points to form a polygon.')
    return []
  }
  if (device.info?.type === 'webgpu') return findPointsInPolygonOnCpu(context, polygonPath)

  const h = context.store.screenSize[1]
  const convertedPath = polygonPath.map(([x, y]) => [x, h - y] as [number, number])
  points.updatePolygonPath(convertedPath)
  if (!points.findPointsInPolygon()) return []
  return extractIndicesFromPixels(readPixels(device, points.searchFbo as Framebuffer))
}

export async function findPointsInPolygonAsync (
  context: RuntimeSelectionContext,
  polygonPath: [number, number][]
): Promise<number[]> {
  if (context.isDestroyed()) return []
  if (!context.isReady()) await context.ready
  const device = context.getDevice()
  const points = context.getPoints()
  if (context.isDestroyed() || !device || !points) return []

  if (polygonPath.length < 3) {
    console.warn('Polygon path requires at least 3 points to form a polygon.')
    return []
  }
  if (device.info?.type !== 'webgpu') return findPointsInPolygon(context, polygonPath)

  const h = context.store.screenSize[1]
  const convertedPath = polygonPath.map(([x, y]) => [x, h - y] as [number, number])
  points.updatePolygonPath(convertedPath)
  if (!points.findPointsInPolygon() || !points.searchFbo) return []
  device.submit()
  const pixels = await readRgba32FloatFramebufferAsync(device, points.searchFbo)
  return extractIndicesFromPixels(pixels)
}

function findPointsInRectOnCpu (
  context: RuntimeSelectionContext,
  rect: [[number, number], [number, number]]
): number[] {
  const positions = context.getBestKnownWebGpuPointPositions()
  const n = context.graph.pointsNumber ?? 0
  return findPointsInRectOnCpuImpl({
    positions,
    pointsNumber: n,
    rect,
    convertSpaceToScreenPosition: (position) => context.zoomInstance.convertSpaceToScreenPosition(position),
  })
}

function findPointsInPolygonOnCpu (
  context: RuntimeSelectionContext,
  polygonPath: [number, number][]
): number[] {
  const positions = context.getBestKnownWebGpuPointPositions()
  const n = context.graph.pointsNumber ?? 0
  return findPointsInPolygonOnCpuImpl({
    positions,
    pointsNumber: n,
    polygonPath,
    convertSpaceToScreenPosition: (position) => context.zoomInstance.convertSpaceToScreenPosition(position),
  })
}
