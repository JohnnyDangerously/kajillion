import { select } from 'd3-selection'
import type { Device } from '@luma.gl/core'

import type { GraphConfigInterface } from '@/graph/config'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Store } from '@/graph/modules/Store'

export interface RuntimeRenderEntryContext {
  isDestroyed: () => boolean;
  ensureDevice: (callback: () => void) => boolean;
  config: GraphConfigInterface;
  graph: GraphData;
  store: Store;
  getCanvas: () => HTMLCanvasElement;
  getDevice: () => Device | undefined;
  isFirstRenderAfterInit: () => boolean;
  setFitViewOnInitTimeoutId: (id: number) => void;
  setFirstRenderAfterInit: (value: boolean) => void;
  flatten: (pointPositions: [number, number][]) => number[];
  fitView: (duration?: number, padding?: number) => void;
  fitViewByPointIndices: (indices: number[], duration?: number, padding?: number) => void;
  setZoomTransformByPointPositions: (positions: Float32Array, duration?: number, scale?: number, padding?: number) => void;
  update: (simulationAlpha?: number) => void;
  stopFrames: () => void;
  startFrames: () => void;
  forceHoverDetection: () => void;
}

export function renderGraphRuntime (
  context: RuntimeRenderEntryContext,
  simulationAlpha: number | undefined,
  requeue: () => void
): void {
  if (context.isDestroyed()) return
  if (context.ensureDevice(requeue)) return
  context.graph.update()
  const {
    fitViewOnInit,
    fitViewDelay,
    fitViewPadding,
    fitViewDuration,
    fitViewByPointsInRect,
    fitViewByPointIndices,
    initialZoomLevel,
  } = context.config
  if (!context.graph.pointsNumber && !context.graph.linksNumber) {
    context.stopFrames()
    select(context.getCanvas()).style('cursor', null)
    const device = context.getDevice()
    if (device) {
      const clearPass = device.beginRenderPass({
        clearColor: context.store.backgroundColor,
        clearDepth: 1,
        clearStencil: 0,
      })
      clearPass.end()
      device.submit()
    }
    return
  }

  if (context.isFirstRenderAfterInit() && fitViewOnInit && initialZoomLevel === undefined) {
    context.setFitViewOnInitTimeoutId(window.setTimeout(() => {
      if (fitViewByPointIndices) {
        context.fitViewByPointIndices(fitViewByPointIndices, fitViewDuration, fitViewPadding)
      } else if (fitViewByPointsInRect) {
        context.setZoomTransformByPointPositions(
          new Float32Array(context.flatten(fitViewByPointsInRect)),
          fitViewDuration,
          undefined,
          fitViewPadding
        )
      } else {
        context.fitView(fitViewDuration, fitViewPadding)
      }
    }, fitViewDelay))
  }

  context.update(simulationAlpha)
  context.forceHoverDetection()
  context.startFrames()
  context.setFirstRenderAfterInit(false)
}
