import { createDefaultConfig } from '@/graph/config'
import { GraphData } from '@/graph/modules/GraphData'
import { Store } from '@/graph/modules/Store'
import { Zoom } from '@/graph/modules/Zoom'
import { Drag } from '@/graph/modules/Drag'
import { PointPositionReadbackCache } from '@/graph/graph/readback/point-position-readback-cache'
import { createLinkHoverPathCache } from '@/graph/graph/hover-picking'
import { createHoverRuntimeState } from '@/graph/graph/hover-runtime'
import { RuntimeFrameLoopController } from '@/graph/graph/runtime-frame-loop-controller'
import type { GraphRuntimeShellOwner } from './runtime-shell-contracts'

export function initializeGraphRuntimeShell (owner: GraphRuntimeShellOwner): void {
  const config = createDefaultConfig()
  const store = new Store()

  Object.assign(owner, {
    config,
    graph: new GraphData(config),
    isReady: false,
    canvas: undefined as unknown as HTMLCanvasElement,
    attributionDivElement: undefined,
    canvasD3Selection: undefined,
    device: undefined,
    isRightClickMouse: false,
    isRenderDirty: true,
    renderDirtyFrameCount: 1,
    isPointImpostorAutoActive: false,
    resolvedRenderPolicy: undefined,
    debugFrameTrace: [],
    debugFrameTraceLimit: 900,
    simFrameCounter: 0,
    store,
    points: undefined,
    lines: undefined,
    forceGravity: undefined,
    forceCenter: undefined,
    forceManyBody: undefined,
    forceLinkIncoming: undefined,
    forceLinkOutgoing: undefined,
    forceMouse: undefined,
    clusters: undefined,
    zoomInstance: new Zoom(store, config),
    dragInstance: new Drag(store, config),
    fpsMonitor: undefined,
    _lastAppliedDpr: undefined,
    _lastInteractionMs: 0,
    _lastAdaptiveTransformX: Number.NaN,
    _lastAdaptiveTransformY: Number.NaN,
    _lastAdaptiveTransformK: Number.NaN,
    timerQueryPool: undefined,
    msaaTarget: undefined,
    lastPhysicsTickMs: Number.NEGATIVE_INFINITY,
    lastSimTickMs: 0,
    webGpuPointPositions: new PointPositionReadbackCache(),
    webGpuPointPickerGrid: undefined,
    webGpuLinkPickerGrid: undefined,
    linkHoverPathCache: createLinkHoverPathCache(),
    currentEvent: undefined,
    hoverState: createHoverRuntimeState(),
    _isFirstRenderAfterInit: true,
    _fitViewOnInitTimeoutID: undefined,
    isPointPositionsUpdateNeeded: false,
    isPointColorUpdateNeeded: false,
    isPointSizeUpdateNeeded: false,
    isPointShapeUpdateNeeded: false,
    isPointImageIndicesUpdateNeeded: false,
    isLinksUpdateNeeded: false,
    isLinkColorUpdateNeeded: false,
    isLinkWidthUpdateNeeded: false,
    isLinkArrowUpdateNeeded: false,
    isPointClusterUpdateNeeded: false,
    isForceManyBodyUpdateNeeded: false,
    isForceLinkUpdateNeeded: false,
    isForceCenterUpdateNeeded: false,
    isPointImageSizesUpdateNeeded: false,
    _isDestroyed: false,
    frameLoop: new RuntimeFrameLoopController({
      isDestroyed: () => owner._isDestroyed,
      config,
      store,
      renderFrame: now => owner.renderFrame(now),
      endSimulation: () => owner.end(),
      traceDebugFrame: (name, data) => owner.traceDebugFrame(name, data),
    }),
  })
}
