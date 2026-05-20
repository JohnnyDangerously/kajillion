import { type Device } from '@luma.gl/core'

import { type GraphConfigInterface } from '@/graph/config'
import { getMaxPointSize, getRgbaColor } from '@/graph/helper'
import { Clusters } from '@/graph/modules/Clusters'
import { ForceCenter } from '@/graph/modules/ForceCenter'
import { ForceGravity } from '@/graph/modules/ForceGravity'
import { ForceLink } from '@/graph/modules/ForceLink'
import { ForceManyBody } from '@/graph/modules/ForceManyBody'
import { ForceMouse } from '@/graph/modules/ForceMouse'
import { type GraphData } from '@/graph/modules/GraphData'
import { Lines } from '@/graph/modules/Lines'
import { Points } from '@/graph/modules/Points'
import { type Store } from '@/graph/modules/Store'
import { type Zoom } from '@/graph/modules/Zoom'

export interface GraphRuntimeModules {
  points: Points
  lines: Lines
  clusters: Clusters
  forceGravity: ForceGravity | undefined
  forceCenter: ForceCenter | undefined
  forceManyBody: ForceManyBody | undefined
  forceLinkIncoming: ForceLink | undefined
  forceLinkOutgoing: ForceLink | undefined
  forceMouse: ForceMouse | undefined
}

export interface InitializeCanvasStateOptions {
  device: Device
  canvas: HTMLCanvasElement
  div: HTMLDivElement
  config: GraphConfigInterface
  store: Store
  zoomInstance: Zoom
}

export function initializeCanvasState ({
  device,
  canvas,
  div,
  config,
  store,
  zoomInstance,
}: InitializeCanvasStateOptions): void {
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  store.div = div
  store.adjustSpaceSize(config.spaceSize, device.limits.maxTextureDimension2D)
  store.setWebGLMaxTextureSize(device.limits.maxTextureDimension2D)
  store.updateScreenSize(canvas.clientWidth, canvas.clientHeight)
  zoomInstance.updateTranslateExtent()
  store.maxPointSize = getMaxPointSize(device, store.effectivePixelRatio)
  store.isSimulationRunning = config.enableSimulation
}

export function createGraphRuntimeModules (
  device: Device,
  config: GraphConfigInterface,
  store: Store,
  graph: GraphData
): GraphRuntimeModules {
  const points = new Points(device, config, store, graph)
  const lines = new Lines(device, config, store, graph, points)
  const forceGravity = config.enableSimulation ? new ForceGravity(device, config, store, graph, points) : undefined
  const forceCenter = config.enableSimulation ? new ForceCenter(device, config, store, graph, points) : undefined
  const forceManyBody = config.enableSimulation ? new ForceManyBody(device, config, store, graph, points) : undefined
  const forceLinkIncoming = config.enableSimulation ? new ForceLink(device, config, store, graph, points) : undefined
  const forceLinkOutgoing = config.enableSimulation ? new ForceLink(device, config, store, graph, points) : undefined
  const forceMouse = config.enableSimulation ? new ForceMouse(device, config, store, graph, points) : undefined
  const clusters = new Clusters(device, config, store, graph, points)

  return {
    points,
    lines,
    clusters,
    forceGravity,
    forceCenter,
    forceManyBody,
    forceLinkIncoming,
    forceLinkOutgoing,
    forceMouse,
  }
}

export function applyInitialStoreConfig (config: GraphConfigInterface, store: Store): void {
  store.backgroundColor = getRgbaColor(config.backgroundColor)
  store.setHoveredPointRingColor(config.hoveredPointRingColor)
  store.setFocusedPointRingColor(config.focusedPointRingColor)
  if (config.focusedPointIndex !== undefined) {
    store.setFocusedPoint(config.focusedPointIndex)
  }
  store.setGreyoutPointColor(config.pointGreyoutColor)
  store.setOutlinedPointRingColor(config.outlinedPointRingColor)
  store.setHighlightedPointSet(config.highlightedPointIndices)
  store.setOutlinedPointSet(config.outlinedPointIndices)
  store.setHoveredLinkColor(config.hoveredLinkColor)
  store.updateLinkHoveringEnabled(config)
}

export function initRuntimePrograms (modules: Partial<GraphRuntimeModules>): void {
  modules.points?.initPrograms()
  modules.lines?.initPrograms()
  modules.forceGravity?.initPrograms()
  modules.forceManyBody?.initPrograms()
  modules.forceCenter?.initPrograms()
  modules.forceLinkIncoming?.initPrograms()
  modules.forceLinkOutgoing?.initPrograms()
  modules.forceMouse?.initPrograms()
  modules.clusters?.initPrograms()
}
