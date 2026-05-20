import { type Framebuffer, type Device } from '@luma.gl/core'

import { readPixels } from '@/graph/helper'
import { type GraphData } from '@/graph/modules/GraphData'
import { type Points } from '@/graph/modules/Points'
import { type Store } from '@/graph/modules/Store'
import { type Zoom } from '@/graph/modules/Zoom'
import { responsiveCameraEase } from '@/graph/graph/runtime-contracts'
import {
  copyPointPositions,
  type PointPositionReadbackCache,
} from '@/graph/graph/readback/point-position-readback-cache'

export interface ReadPointPositionsContext {
  device: Device
  graph: GraphData
  points: Points
  pointPositionCache: PointPositionReadbackCache
  requestWebGpuPointPositionsSnapshot: () => void
}

export function readPointPositionsSync ({
  device,
  graph,
  points,
  pointPositionCache,
  requestWebGpuPointPositionsSnapshot,
}: ReadPointPositionsContext): number[] {
  const pointsNumber = graph.pointsNumber
  if (pointsNumber === undefined) return []

  if (device.info?.type === 'webgpu') {
    if (pointPositionCache.isStale) requestWebGpuPointPositionsSnapshot()
    return copyPointPositions(
      pointPositionCache.cachedPositions ?? graph.inputPointPositions,
      pointsNumber
    )
  }

  const positions: number[] = []
  positions.length = pointsNumber * 2
  const pointPositionsPixels = readPixels(device, points.currentPositionFbo as Framebuffer)
  for (let i = 0; i < pointsNumber; i += 1) {
    const posX = pointPositionsPixels[i * 4 + 0]
    const posY = pointPositionsPixels[i * 4 + 1]
    if (posX !== undefined && posY !== undefined) {
      positions[i * 2] = posX
      positions[i * 2 + 1] = posY
    }
  }
  return positions
}

export interface ReadbackViewContext {
  isDestroyed: () => boolean
  readbackPointPositions: () => Promise<Float32Array>
  setZoomTransformByPointPositions: (
    positions: Float32Array,
    duration?: number,
    scale?: number,
    padding?: number,
    enableSimulation?: boolean
  ) => void
}

export async function fitViewFromReadback (
  context: ReadbackViewContext,
  duration = 250,
  padding = 0.1,
  enableSimulation = true
): Promise<void> {
  try {
    const positions = await context.readbackPointPositions()
    if (context.isDestroyed() || positions.length === 0) return
    context.setZoomTransformByPointPositions(positions, duration, undefined, padding, enableSimulation)
  } catch (error) {
    console.warn('[kajillion] WebGPU fitView readback failed', error)
  }
}

export async function fitViewByPointIndicesFromReadback (
  context: ReadbackViewContext,
  indices: number[],
  duration = 250,
  padding = 0.1,
  enableSimulation = true
): Promise<void> {
  try {
    const positionsArray = await context.readbackPointPositions()
    if (context.isDestroyed() || positionsArray.length === 0) return
    const positions = new Float32Array(indices.length * 2)
    for (const [i, index] of indices.entries()) {
      positions[i * 2] = positionsArray[index * 2] ?? 0
      positions[i * 2 + 1] = positionsArray[index * 2 + 1] ?? 0
    }
    context.setZoomTransformByPointPositions(positions, duration, undefined, padding, enableSimulation)
  } catch (error) {
    console.warn('[kajillion] WebGPU fitViewByPointIndices readback failed', error)
  }
}

export interface ZoomToPointReadbackContext extends ReadbackViewContext {
  hasCanvasSelection: () => boolean
  getZoomLevel: () => number
  store: Store
  zoomInstance: Zoom
}

export async function zoomToPointByIndexFromReadback (
  context: ZoomToPointReadbackContext,
  index: number,
  duration = 700,
  scale = 3,
  canZoomOut = true,
  enableSimulation = true
): Promise<void> {
  try {
    if (!context.hasCanvasSelection()) return
    const positions = await context.readbackPointPositions()
    if (context.isDestroyed() || positions.length === 0) return
    const posX = positions[index * 2]
    const posY = positions[index * 2 + 1]
    if (posX === undefined || posY === undefined) return
    const distance = context.zoomInstance.getDistanceToPoint([posX, posY])
    const zoomLevel = canZoomOut ? scale : Math.max(context.getZoomLevel(), scale)
    if (distance < Math.min(context.store.screenSize[0], context.store.screenSize[1])) {
      context.setZoomTransformByPointPositions(new Float32Array([posX, posY]), duration, zoomLevel, undefined, enableSimulation)
    } else {
      const transform = context.zoomInstance.getTransform([posX, posY], zoomLevel)
      context.zoomInstance.shouldEnableSimulationDuringZoomOverride = enableSimulation
      context.zoomInstance.setTransform(transform, duration, responsiveCameraEase)
    }
  } catch (error) {
    console.warn('[kajillion] WebGPU zoomToPointByIndex readback failed', error)
  }
}
