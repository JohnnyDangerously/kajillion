import type { GraphConfigInterface } from '@/graph/config'
import { resolveAdaptiveRenderPolicy, type ResolvedRenderPolicy } from '@/graph/render/resolveAdaptiveRenderPolicy'
import { runHoverDetection } from '@/graph/graph/hover-runtime'
import { applyConfigUpdateState, preserveInitOnlyConfigFields } from '@/graph/graph/config-state/apply-config-update-state'
import { initRuntimePrograms } from '@/graph/graph/runtime-setup'
import { traceRuntimeDebugFrame } from '@/graph/graph/runtime-debug'
import { runGraphSimulationStep } from '@/graph/graph/runtime-simulation-step'
import { applyPendingGraphUpdates } from '@/graph/graph/runtime-updates'
import type { GraphStateAdapterOwner } from '@/graph/graph/runtime-state-adapter-owner'

export type { GraphStateAdapterOwner } from '@/graph/graph/runtime-state-adapter-owner'

export function applyGraphConfigUpdate (owner: GraphStateAdapterOwner, prevConfig: GraphConfigInterface): void {
  preserveInitOnlyConfigFields(owner.config, prevConfig)
  applyConfigUpdateState(prevConfig, {
    config: owner.config,
    graph: owner.graph,
    points: owner.points,
    lines: owner.lines,
    store: owner.store,
    device: owner.device,
    canvas: owner.canvas,
    fpsMonitor: owner.fpsMonitor,
    timerQueryPool: owner.timerQueryPool,
    zoomInstance: owner.zoomInstance,
    setFpsMonitor: fpsMonitor => { owner.fpsMonitor = fpsMonitor },
    setTimerQueryPool: timerQueryPool => { owner.timerQueryPool = timerQueryPool },
    markLinksChanged: () => owner.markLinksChanged(),
    markRenderDirty: () => owner.markRenderDirty(),
    resetAdaptiveDpr: () => { owner._lastAppliedDpr = undefined },
    maybeApplyAdaptiveDpr: nowMs => owner.maybeApplyAdaptiveDpr(nowMs),
    applyEffectivePixelRatio: ratio => owner.applyEffectivePixelRatio(ratio),
    resizeCanvas: forceResize => owner.resizeCanvas(forceResize),
    update: simulationAlpha => owner.update(simulationAlpha),
    updateZoomDragBehaviors: () => owner.updateZoomDragBehaviors(),
  })
}

export function applyGraphPendingUpdates (owner: GraphStateAdapterOwner): void {
  if (!owner.points || !owner.lines) return
  Object.assign(owner, applyPendingGraphUpdates({
    flags: {
      isPointPositionsUpdateNeeded: owner.isPointPositionsUpdateNeeded,
      isPointColorUpdateNeeded: owner.isPointColorUpdateNeeded,
      isPointSizeUpdateNeeded: owner.isPointSizeUpdateNeeded,
      isPointShapeUpdateNeeded: owner.isPointShapeUpdateNeeded,
      isPointImageIndicesUpdateNeeded: owner.isPointImageIndicesUpdateNeeded,
      isLinksUpdateNeeded: owner.isLinksUpdateNeeded,
      isLinkColorUpdateNeeded: owner.isLinkColorUpdateNeeded,
      isLinkWidthUpdateNeeded: owner.isLinkWidthUpdateNeeded,
      isLinkArrowUpdateNeeded: owner.isLinkArrowUpdateNeeded,
      isPointClusterUpdateNeeded: owner.isPointClusterUpdateNeeded,
      isForceManyBodyUpdateNeeded: owner.isForceManyBodyUpdateNeeded,
      isForceLinkUpdateNeeded: owner.isForceLinkUpdateNeeded,
      isForceCenterUpdateNeeded: owner.isForceCenterUpdateNeeded,
      isPointImageSizesUpdateNeeded: owner.isPointImageSizesUpdateNeeded,
    },
    points: owner.points,
    lines: owner.lines,
    forceManyBody: owner.forceManyBody,
    forceLinkIncoming: owner.forceLinkIncoming,
    forceLinkOutgoing: owner.forceLinkOutgoing,
    forceCenter: owner.forceCenter,
    clusters: owner.clusters,
  }))
}

export function traceGraphDebugFrame (
  owner: GraphStateAdapterOwner,
  name: string,
  data?: Record<string, unknown>,
): void {
  const counters = owner.frameLoop.getCounters()
  traceRuntimeDebugFrame({
    enabled: owner.config.debugFrameTrace,
    trace: owner.debugFrameTrace,
    limit: owner.debugFrameTraceLimit,
    name,
    data,
    rafCallbackCount: counters.rafCallbackCount,
    renderedFrameCount: counters.renderedFrameCount,
    skippedFrameCount: counters.skippedFrameCount,
    isRenderDirty: owner.isRenderDirty,
    renderDirtyFrameCount: owner.renderDirtyFrameCount,
    currentEvent: owner.currentEvent,
    store: owner.store,
    zoomInstance: owner.zoomInstance,
    dragInstance: owner.dragInstance,
    canvas: owner.canvas,
  })
}

export function resolveGraphRenderPolicy (owner: GraphStateAdapterOwner): ResolvedRenderPolicy {
  const policy = resolveAdaptiveRenderPolicy({
    isWebGPU: owner.device?.info?.type === 'webgpu',
    renderLodMode: owner.config.renderLodMode,
    pointCount: owner.graph.pointsNumber ?? 0,
    linkCount: owner.graph.linksNumber ?? 0,
    activePointCount: owner.config.activePointIndices?.length,
    activeLinkCount: owner.config.activeLinkIndices?.length,
    hasActivePointFilter: owner.config.activePointIndices !== undefined,
    hasActiveLinkFilter: owner.config.activeLinkIndices !== undefined,
    canvasCssWidth: owner.canvas?.clientWidth ?? owner.store.screenSize[0] ?? 0,
    canvasCssHeight: owner.canvas?.clientHeight ?? owner.store.screenSize[1] ?? 0,
    zoomDistance: owner.getZoomDistance(),
    zoomLevel: owner.zoomInstance.eventTransform.k,
    impostorAutoMinPoints: owner.config.impostorAutoMinPoints,
    impostorAutoMaxZoom: owner.config.impostorAutoMaxZoom,
    previousState: owner.resolvedRenderPolicy?.state,
  })
  owner.isPointImpostorAutoActive = policy.pointMode === 'impostor'
  owner.resolvedRenderPolicy = policy
  return policy
}

export function runGraphRuntimeSimulationStep (owner: GraphStateAdapterOwner, forceExecution = false): void {
  const state = runGraphSimulationStep({
    config: owner.config,
    graph: owner.graph,
    store: owner.store,
    points: owner.points,
    forceGravity: owner.forceGravity,
    forceCenter: owner.forceCenter,
    forceManyBody: owner.forceManyBody,
    forceLinkIncoming: owner.forceLinkIncoming,
    forceLinkOutgoing: owner.forceLinkOutgoing,
    forceMouse: owner.forceMouse,
    clusters: owner.clusters,
    zoomInstance: owner.zoomInstance,
    timerQueryPool: owner.timerQueryPool,
    isRightClickMouse: owner.isRightClickMouse,
    simFrameCounter: owner.simFrameCounter,
    lastSimTickMs: owner.lastSimTickMs,
    markPointPositionsChanged: () => owner.markPointPositionsChanged(),
  }, forceExecution)
  owner.simFrameCounter = state.simFrameCounter
  owner.lastSimTickMs = state.lastSimTickMs
}

export function initGraphRuntimePrograms (owner: GraphStateAdapterOwner): void {
  if (owner._isDestroyed || !owner.points || !owner.lines || !owner.clusters) return
  initRuntimePrograms({
    points: owner.points,
    lines: owner.lines,
    clusters: owner.clusters,
    forceGravity: owner.forceGravity,
    forceManyBody: owner.forceManyBody,
    forceCenter: owner.forceCenter,
    forceLinkIncoming: owner.forceLinkIncoming,
    forceLinkOutgoing: owner.forceLinkOutgoing,
    forceMouse: owner.forceMouse,
  })
}

export function runGraphHoverDetection (owner: GraphStateAdapterOwner): void {
  runHoverDetection({
    isDestroyed: owner._isDestroyed,
    canvas: owner.canvas,
    config: owner.config,
    graph: owner.graph,
    store: owner.store,
    device: owner.device,
    points: owner.points,
    lines: owner.lines,
    pointPositions: owner.webGpuPointPositions,
    linkHoverPathCache: owner.linkHoverPathCache,
    currentEvent: owner.currentEvent,
    isDragActive: owner.dragInstance.isActive,
    hoverState: owner.hoverState,
    getPointPickerGrid: () => owner.webGpuPointPickerGrid,
    getLinkPickerGrid: () => owner.webGpuLinkPickerGrid,
    rebuildPointPickerGrid: positions => owner.rebuildWebGpuPointPickerGrid(positions),
    rebuildLinkPickerGrid: positions => owner.rebuildWebGpuLinkPickerGrid(positions),
    requestPointPositionsSnapshot: force => owner.requestWebGpuPointPositionsSnapshot(force),
    transform: owner.zoomInstance.eventTransform,
  })
}
