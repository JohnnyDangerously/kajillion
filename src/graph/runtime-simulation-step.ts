import type { GraphConfigInterface } from '@/graph/config'
import type { Clusters } from '@/graph/modules/Clusters'
import type { ForceCenter } from '@/graph/modules/ForceCenter'
import type { ForceGravity } from '@/graph/modules/ForceGravity'
import type { ForceLink } from '@/graph/modules/ForceLink'
import type { ForceManyBody } from '@/graph/modules/ForceManyBody'
import type { ForceMouse } from '@/graph/modules/ForceMouse'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Points } from '@/graph/modules/Points'
import { ALPHA_MIN, type Store } from '@/graph/modules/Store'
import type { Zoom } from '@/graph/modules/Zoom'
import type { ITimerQueryPool } from '@/graph/perf'

import {
  getForceThrottleAlpha,
  resolveAlphaStopThreshold,
} from './runtime-render-loop'

export interface GraphSimulationStepState {
  simFrameCounter: number;
  lastSimTickMs: number;
}

export interface GraphSimulationStepContext extends GraphSimulationStepState {
  config: GraphConfigInterface;
  graph: GraphData;
  store: Store;
  points: Points | undefined;
  forceGravity: ForceGravity | undefined;
  forceCenter: ForceCenter | undefined;
  forceManyBody: ForceManyBody | undefined;
  forceLinkIncoming: ForceLink | undefined;
  forceLinkOutgoing: ForceLink | undefined;
  forceMouse: ForceMouse | undefined;
  clusters: Clusters | undefined;
  zoomInstance: Pick<Zoom, 'isRunning' | 'shouldEnableSimulationDuringZoomOverride'>;
  timerQueryPool: ITimerQueryPool | undefined;
  isRightClickMouse: boolean;
  markPointPositionsChanged: () => void;
  nowMs?: () => number;
  isDocumentHidden?: () => boolean;
}

export function runGraphSimulationStep (
  context: GraphSimulationStepContext,
  forceExecution = false
): GraphSimulationStepState {
  const {
    config,
    graph,
    store,
    points,
    forceGravity,
    forceCenter,
    forceManyBody,
    forceLinkIncoming,
    forceLinkOutgoing,
    forceMouse,
    clusters,
    zoomInstance,
    timerQueryPool,
    isRightClickMouse,
    markPointPositionsChanged,
  } = context
  const { simulationGravity, simulationCenter, enableSimulation } = config
  const { isSimulationRunning } = store
  let { simFrameCounter, lastSimTickMs } = context

  if (!enableSimulation) return { simFrameCounter, lastSimTickMs }

  // Right-click repulsion runs regardless of isSimulationRunning.
  if (isRightClickMouse && config.enableRightClickRepulsion) {
    timerQueryPool?.begin('force.mouse')
    points?.swapFbo()
    forceMouse?.run()
    points?.updatePosition()
    timerQueryPool?.end()
  }

  const enableSimulationDuringZoom = zoomInstance.shouldEnableSimulationDuringZoomOverride ?? config.enableSimulationDuringZoom
  let shouldRunSimulation = forceExecution ||
    (isSimulationRunning && !(zoomInstance.isRunning && !enableSimulationDuringZoom))

  // During the settle tail, throttle expensive force passes on automatic frames.
  // Manual step() keeps exact behavior by setting forceExecution.
  const forceThrottleAlpha = getForceThrottleAlpha(graph.pointsNumber ?? 0)
  const forceThrottleStride = 2
  if (!forceExecution && shouldRunSimulation && store.alpha < forceThrottleAlpha) {
    simFrameCounter = (simFrameCounter + 1) | 0
    if ((simFrameCounter % forceThrottleStride) !== 0) {
      shouldRunSimulation = false
    }
  }

  if (shouldRunSimulation) {
    if (simulationGravity) {
      timerQueryPool?.begin('force.gravity')
      points?.swapFbo()
      forceGravity?.run()
      points?.updatePosition()
      timerQueryPool?.end()
    }

    if (simulationCenter) {
      timerQueryPool?.begin('force.center')
      points?.swapFbo()
      forceCenter?.run()
      points?.updatePosition()
      timerQueryPool?.end()
    }

    points?.swapFbo()
    timerQueryPool?.begin('force.quadtree.build')
    const quadtreeReady = forceManyBody?.runQuadtreeBuild() ?? false
    timerQueryPool?.end()
    timerQueryPool?.begin('force.repulsion')
    if (quadtreeReady) forceManyBody?.runForceSample()
    points?.updatePosition()
    timerQueryPool?.end()

    if (store.linksTextureSize) {
      timerQueryPool?.begin('force.link.incoming')
      points?.swapFbo()
      forceLinkIncoming?.run()
      points?.updatePosition()
      timerQueryPool?.end()
      timerQueryPool?.begin('force.link.outgoing')
      points?.swapFbo()
      forceLinkOutgoing?.run()
      points?.updatePosition()
      timerQueryPool?.end()
    }

    if (graph.pointClusters || graph.clusterPositions) {
      timerQueryPool?.begin('force.cluster')
      points?.swapFbo()
      clusters?.run()
      points?.updatePosition()
      timerQueryPool?.end()
    }

    const tickNowMs = context.nowMs?.() ?? performance.now()
    let dtScale = 1.0
    if (lastSimTickMs > 0) {
      const dt = tickNowMs - lastSimTickMs
      if (context.isDocumentHidden?.() ?? (typeof document !== 'undefined' && document.hidden)) {
        lastSimTickMs = tickNowMs
      } else if (!Number.isFinite(dt) || dt > 1000) {
        lastSimTickMs = tickNowMs
        dtScale = 0
      } else {
        dtScale = Math.min(10, Math.max(0.1, dt / (1000 / 60)))
        lastSimTickMs = tickNowMs
      }
    } else {
      lastSimTickMs = tickNowMs
    }
    if (dtScale > 0) {
      store.alpha += store.addAlpha(config.simulationDecay) * dtScale
    }
    if (isRightClickMouse && config.enableRightClickRepulsion) {
      store.alpha = Math.max(store.alpha, 0.1)
    }

    const stopThreshold = resolveAlphaStopThreshold(config.alphaStopThreshold)
    store.simulationProgress = Math.sqrt(Math.min(1, stopThreshold / Math.max(store.alpha, ALPHA_MIN)))

    config.onSimulationTick?.(
      store.alpha,
      store.hoveredPoint?.index,
      store.hoveredPoint?.position
    )
    markPointPositionsChanged()
  }

  points?.trackPoints()

  return { simFrameCounter, lastSimTickMs }
}
