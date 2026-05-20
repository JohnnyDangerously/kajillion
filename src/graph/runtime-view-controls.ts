import { type Framebuffer, type Device } from '@luma.gl/core'
import type { Selection } from 'd3-selection'

import { readPixels } from '@/graph/helper'
import type { Points } from '@/graph/modules/Points'
import type { Store } from '@/graph/modules/Store'
import type { Zoom } from '@/graph/modules/Zoom'
import { responsiveCameraEase } from '@/graph/graph/runtime-contracts'
import {
  fitViewByPointIndicesFromReadback,
  fitViewFromReadback,
  type ReadbackViewContext,
  zoomToPointByIndexFromReadback,
} from '@/graph/graph/point-position-views'

export interface RuntimeViewControlContext {
  isDestroyed: () => boolean
  ensureDevice: (callback: () => void) => boolean
  getDevice: () => Device | undefined
  getPoints: () => Points | undefined
  getCanvasSelection: () => Selection<HTMLCanvasElement, undefined, null, undefined> | undefined
  getPointPositions: () => number[]
  readbackPointPositions: () => Promise<Float32Array>
  resizeCanvas: () => void
  store: Store
  zoomInstance: Zoom
}

const createReadbackViewContext = (context: RuntimeViewControlContext): ReadbackViewContext => ({
  isDestroyed: context.isDestroyed,
  readbackPointPositions: context.readbackPointPositions,
  setZoomTransformByPointPositions: (
    positions: Float32Array,
    duration?: number,
    scale?: number,
    padding?: number,
    enableSimulation?: boolean
  ) => setRuntimeZoomTransformByPointPositions(context, positions, duration, scale, padding, enableSimulation),
})

export function zoomRuntimeToPointByIndex (
  context: RuntimeViewControlContext,
  index: number,
  duration = 700,
  scale = 3,
  canZoomOut = true,
  enableSimulation = true,
  requeue: () => void,
): void {
  if (context.isDestroyed()) return
  if (context.ensureDevice(requeue)) return
  const device = context.getDevice()
  const points = context.getPoints()
  if (!device || !points || !context.getCanvasSelection()) return
  if (device.info?.type === 'webgpu') {
    zoomToPointByIndexFromReadback({
      ...createReadbackViewContext(context),
      hasCanvasSelection: () => !!context.getCanvasSelection(),
      getZoomLevel: () => context.zoomInstance.eventTransform.k,
      store: context.store,
      zoomInstance: context.zoomInstance,
    }, index, duration, scale, canZoomOut, enableSimulation).catch((error) => {
      console.warn('[kajillion] WebGPU zoomToPointByIndex failed', error)
    })
    return
  }
  const { screenSize } = context.store
  const positionPixels = readPixels(device, points.currentPositionFbo as Framebuffer)
  if (index === undefined) return
  const posX = positionPixels[index * 4 + 0]
  const posY = positionPixels[index * 4 + 1]
  if (posX === undefined || posY === undefined) return
  const distance = context.zoomInstance.getDistanceToPoint([posX, posY])
  const zoomLevel = canZoomOut ? scale : Math.max(context.zoomInstance.eventTransform.k, scale)
  if (distance < Math.min(screenSize[0], screenSize[1])) {
    setRuntimeZoomTransformByPointPositions(context, new Float32Array([posX, posY]), duration, zoomLevel, undefined, enableSimulation)
  } else {
    context.zoomInstance.shouldEnableSimulationDuringZoomOverride = enableSimulation
    const transform = context.zoomInstance.getTransform([posX, posY], zoomLevel)
    context.zoomInstance.setTransform(transform, duration, responsiveCameraEase)
  }
}

export function fitRuntimeView (
  context: RuntimeViewControlContext,
  duration = 250,
  padding = 0.1,
  enableSimulation = true,
  requeue: () => void,
): void {
  if (context.isDestroyed()) return
  if (context.ensureDevice(requeue)) return
  if (context.getDevice()?.info?.type === 'webgpu') {
    fitViewFromReadback(createReadbackViewContext(context), duration, padding, enableSimulation).catch((error) => {
      console.warn('[kajillion] WebGPU fitView failed', error)
    })
    return
  }
  setRuntimeZoomTransformByPointPositions(context, new Float32Array(context.getPointPositions()), duration, undefined, padding, enableSimulation)
}

export function fitRuntimeViewByPointIndices (
  context: RuntimeViewControlContext,
  indices: number[],
  duration = 250,
  padding = 0.1,
  enableSimulation = true,
  requeue: () => void,
): void {
  if (context.isDestroyed()) return
  if (context.ensureDevice(requeue)) return
  if (context.getDevice()?.info?.type === 'webgpu') {
    fitViewByPointIndicesFromReadback(createReadbackViewContext(context), indices, duration, padding, enableSimulation).catch((error) => {
      console.warn('[kajillion] WebGPU fitViewByPointIndices failed', error)
    })
    return
  }
  const positionsArray = context.getPointPositions()
  const positions = new Float32Array(indices.length * 2)
  for (const [i, index] of indices.entries()) {
    positions[i * 2] = positionsArray[index * 2] as number
    positions[i * 2 + 1] = positionsArray[index * 2 + 1] as number
  }
  setRuntimeZoomTransformByPointPositions(context, positions, duration, undefined, padding, enableSimulation)
}

export function fitRuntimeViewByPointPositions (
  context: RuntimeViewControlContext,
  positions: number[],
  duration = 250,
  padding = 0.1,
  enableSimulation = true,
  requeue: () => void,
): void {
  if (context.isDestroyed()) return
  if (context.ensureDevice(requeue)) return
  setRuntimeZoomTransformByPointPositions(context, new Float32Array(positions), duration, undefined, padding, enableSimulation)
}

export function setRuntimeZoomTransformByPointPositions (
  context: RuntimeViewControlContext,
  positions: Float32Array,
  duration = 250,
  scale?: number,
  padding = 0.1,
  enableSimulation = true,
  requeue?: () => void,
): void {
  if (context.isDestroyed()) return
  if (requeue && context.ensureDevice(requeue)) return
  context.zoomInstance.shouldEnableSimulationDuringZoomOverride = enableSimulation
  context.resizeCanvas()
  const transform = context.zoomInstance.getTransform(positions, scale, padding)
  context.zoomInstance.setTransform(transform, duration, responsiveCameraEase)
}
