import type { Framebuffer } from '@luma.gl/core'

import { readPixels } from '@/graph/helper'
import {
  clearHoveredLink,
  emptyHoverChange,
  findHoveredLinkOnCpu as findHoveredLinkOnCpuState,
  findHoveredPointOnCpu as findHoveredPointOnCpuState,
  updateHoveredLinkIndex,
  updateHoveredPointFromFramebufferPixels,
  type HoverChange,
  type HoverDetectionResult,
} from '@/graph/graph/hover-picking'
import type { HoverRuntimeContext } from '@/graph/graph/hover-runtime/contracts'

export function findHoveredItemOnCpu (context: HoverRuntimeContext): HoverDetectionResult {
  const point = findHoveredPoint(context)
  let link = emptyHoverChange()

  if (context.graph.linksNumber && context.store.isLinkHoveringEnabled) {
    link = findHoveredLine(context)
  } else if (context.store.hoveredLinkIndex !== undefined) {
    link = clearHoveredLink(context.store)
  }

  return { point, link }
}

export function findHoveredItemOnGpu (context: HoverRuntimeContext): HoverDetectionResult {
  const point = findHoveredPointOnCpu(context)
  let link = emptyHoverChange()

  if (context.graph.linksNumber && context.store.isLinkHoveringEnabled && !context.store.hoveredPoint) {
    link = findHoveredLineOnCpu(context)
  } else if (context.store.hoveredLinkIndex !== undefined) {
    link = clearHoveredLink(context.store)
  }

  return { point, link }
}

function findHoveredPoint (context: HoverRuntimeContext): HoverChange {
  const { device, points } = context
  if (context.isDestroyed || !device || !points) return emptyHoverChange()
  if (device.info?.type === 'webgpu') return findHoveredPointOnCpu(context)
  points.findHoveredPoint()
  const pixels = readPixels(device, points.hoveredFbo as Framebuffer, 0, 0, 2, 2)
  // Shader writes: rgba = vec4(index, size, pointPosition.xy)
  return updateHoveredPointFromFramebufferPixels(context.store, pixels)
}

function findHoveredPointOnCpu (context: HoverRuntimeContext): HoverChange {
  if (context.pointPositions.isStale && !context.store.isSimulationRunning) {
    context.requestPointPositionsSnapshot()
  }
  const positions = context.pointPositions.cachedPositions ?? context.graph.inputPointPositions
  if (!positions) return emptyHoverChange()
  const grid = context.getPointPickerGrid()
  if (!grid || grid.positions !== positions) {
    context.rebuildPointPickerGrid(positions)
  }
  return findHoveredPointOnCpuState({
    config: context.config,
    graph: context.graph,
    grid: context.getPointPickerGrid(),
    positions,
    store: context.store,
    transform: context.transform,
  })
}

function findHoveredLine (context: HoverRuntimeContext): HoverChange {
  const { device, lines, store } = context
  if (context.isDestroyed || !lines || !device) return emptyHoverChange()
  if (device.info?.type === 'webgpu') return findHoveredLineOnCpu(context)
  if (store.hoveredPoint) return clearHoveredLink(store)

  lines.findHoveredLine()
  const pixels = readPixels(device, lines.hoveredLineIndexFbo!)
  const hoveredLineIndex = pixels[0] as number

  return updateHoveredLinkIndex(store, hoveredLineIndex)
}

function findHoveredLineOnCpu (context: HoverRuntimeContext): HoverChange {
  const { graph, pointPositions, store } = context
  if (store.hoveredPoint) return clearHoveredLink(store)
  if (pointPositions.isStale && !store.isSimulationRunning) {
    context.requestPointPositionsSnapshot()
  }
  const positions = pointPositions.cachedPositions ?? graph.inputPointPositions
  const links = graph.links
  const linksNumber = graph.linksNumber ?? 0
  const grid = context.getLinkPickerGrid()
  if (positions && links && linksNumber > 0 && (!grid || grid.positions !== positions || grid.links !== links)) {
    context.rebuildLinkPickerGrid(positions)
  }
  return findHoveredLinkOnCpuState({
    cache: context.linkHoverPathCache,
    config: context.config,
    graph,
    grid: context.getLinkPickerGrid(),
    links,
    linksNumber,
    positions,
    store,
    transform: context.transform,
  })
}
