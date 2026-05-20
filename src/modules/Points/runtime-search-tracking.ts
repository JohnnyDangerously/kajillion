import type { Framebuffer } from '@luma.gl/core'
import { readPixels } from '@/graph/helper'
import {
  fillSampledPointsFramebuffer,
  readSampledPointPositionsMap,
  readSampledPoints,
  runFindHoveredPoint,
  runFindPointsInPolygon,
  runFindPointsInRect,
  updatePolygonPathTexture,
} from '@/graph/modules/Points/passes/search/selection'
import {
  createTrackedPositionsArray,
  createTrackedPositionsMap,
} from '@/graph/modules/Points/passes/tracking/readback'
import { runTrackPoints } from '@/graph/modules/Points/passes/tracking/setup'
import { ensureTrackedPointTargets } from '@/graph/modules/Points/passes/tracking/tracked-indices'

type PointsRuntime = any

function runtime (points: unknown): PointsRuntime {
  return points as PointsRuntime
}

export function trackPoints (points: unknown): void {
  const p = runtime(points)
  runTrackPoints({
    device: p.device,
    command: p.trackPointsCommand,
    uniformStore: p.trackPointsUniformStore,
    trackedPositionsFbo: p.trackedPositionsFbo,
    currentPositionTexture: p.currentPositionTexture,
    trackedIndicesTexture: p.trackedIndicesTexture,
    pointsTextureSize: p.store.pointsTextureSize ?? 0,
    hasTrackedIndices: !!p.trackedIndices?.length,
  })
}

export function findPointsInRect (points: unknown): boolean {
  const p = runtime(points)
  return runFindPointsInRect({
    device: p.device,
    command: p.findPointsInRectCommand,
    uniformStore: p.findPointsInRectUniformStore,
    searchFbo: p.searchFbo,
    currentPositionTexture: p.currentPositionTexture,
    sizeTexture: p.sizeTexture,
    config: p.config,
    store: p.store,
    effectivePixelRatio: p.effectivePixelRatio,
  })
}

export function findPointsInPolygon (points: unknown): boolean {
  const p = runtime(points)
  return runFindPointsInPolygon({
    device: p.device,
    command: p.findPointsInPolygonCommand,
    uniformStore: p.findPointsInPolygonUniformStore,
    searchFbo: p.searchFbo,
    currentPositionTexture: p.currentPositionTexture,
    polygonPathTexture: p.polygonPathTexture,
    polygonPathLength: p.polygonPathLength,
    store: p.store,
  })
}

export function updatePolygonPath (points: unknown, polygonPath: [number, number][]): void {
  const p = runtime(points)
  const state = updatePolygonPathTexture(p.device, polygonPath, p.polygonPathTexture)
  p.polygonPathLength = state.length
  p.polygonPathTexture = state.texture
}

export function findHoveredPoint (points: unknown): void {
  const p = runtime(points)
  if (!p.pointStatusTexture) p.updatePointStatus()
  runFindHoveredPoint({
    device: p.device,
    command: p.findHoveredPointCommand,
    uniformStore: p.findHoveredPointUniformStore,
    hoveredFbo: p.hoveredFbo,
    currentPositionTexture: p.currentPositionTexture,
    pointStatusTexture: p.pointStatusTexture,
    hoveredPointIndices: p.hoveredPointIndices,
    sizeBuffer: p.sizeBuffer,
    imageSizesBuffer: p.imageSizesBuffer,
    config: p.config,
    store: p.store,
    pointCount: p.data.pointsNumber ?? 0,
    effectivePixelRatio: p.effectivePixelRatio,
  })
}

export function trackPointsByIndices (points: unknown, indices?: number[] | undefined): void {
  const p = runtime(points)
  const { store: { pointsTextureSize }, device } = p
  p.trackedIndices = indices
  p.trackedPositions = undefined
  p.isPositionsUpToDate = false

  if (!indices?.length || !pointsTextureSize) return
  const trackedTargets = ensureTrackedPointTargets(device, indices, pointsTextureSize, {
    trackedIndicesTexture: p.trackedIndicesTexture,
    trackedPositionsFbo: p.trackedPositionsFbo,
  })
  p.trackedIndicesTexture = trackedTargets.trackedIndicesTexture
  p.trackedPositionsFbo = trackedTargets.trackedPositionsFbo

  p.trackPoints()
}

export function getTrackedPositionsMap (points: unknown): ReadonlyMap<number, [number, number]> {
  const p = runtime(points)
  if (!p.trackedIndices) return new Map()

  const { config: { enableSimulation }, store: { isSimulationRunning } } = p
  if ((!enableSimulation || !isSimulationRunning) &&
      p.isPositionsUpToDate &&
      p.trackedPositions) {
    return p.trackedPositions
  }

  if (!p.trackedPositionsFbo || p.trackedPositionsFbo.destroyed) return new Map()

  const pixels = readPixels(p.device, p.trackedPositionsFbo as Framebuffer)
  const tracked = createTrackedPositionsMap(pixels, p.trackedIndices)

  if (!enableSimulation || !isSimulationRunning) {
    p.trackedPositions = tracked
    p.isPositionsUpToDate = true
  }

  return tracked
}

export function getSampledPointPositionsMap (points: unknown): Map<number, [number, number]> {
  const p = runtime(points)
  if (!p.sampledPointsFbo || p.sampledPointsFbo.destroyed) return new Map()
  if (!fillSampledPointsFramebuffer({
    device: p.device,
    command: p.fillSampledPointsFboCommand,
    uniformStore: p.fillSampledPointsUniformStore,
    sampledPointsFbo: p.sampledPointsFbo,
    currentPositionTexture: p.currentPositionTexture,
    store: p.store,
    pointCount: p.data.pointsNumber ?? 0,
  })) return new Map()
  const pixels = readPixels(p.device, p.sampledPointsFbo as Framebuffer)
  return readSampledPointPositionsMap(pixels)
}

export function getSampledPoints (points: unknown): { indices: number[]; positions: number[] } {
  const p = runtime(points)
  const empty = { indices: [], positions: [] }
  if (!p.sampledPointsFbo || p.sampledPointsFbo.destroyed) return empty
  if (!fillSampledPointsFramebuffer({
    device: p.device,
    command: p.fillSampledPointsFboCommand,
    uniformStore: p.fillSampledPointsUniformStore,
    sampledPointsFbo: p.sampledPointsFbo,
    currentPositionTexture: p.currentPositionTexture,
    store: p.store,
    pointCount: p.data.pointsNumber ?? 0,
  })) return empty
  const pixels = readPixels(p.device, p.sampledPointsFbo as Framebuffer)
  return readSampledPoints(pixels)
}

export function getTrackedPositionsArray (points: unknown): number[] {
  const p = runtime(points)
  if (!p.trackedIndices) return []
  if (!p.trackedPositionsFbo || p.trackedPositionsFbo.destroyed) return []
  const pixels = readPixels(p.device, p.trackedPositionsFbo as Framebuffer)
  return createTrackedPositionsArray(pixels, p.trackedIndices)
}
