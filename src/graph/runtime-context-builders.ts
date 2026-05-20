import type { RuntimeSelectionContext } from '@/graph/graph/selection/runtime-selection'
import type { GraphAccessorContext } from '@/graph/graph/runtime-accessors'
import type { RuntimeCanvasContext } from '@/graph/graph/runtime-canvas'
import type { GraphRuntimeContextOwner } from '@/graph/graph/runtime-context-owner'
import type { RuntimeDataUpdateContext } from '@/graph/graph/runtime-data-setters'
import type { RuntimeFrameRendererContext } from '@/graph/graph/runtime-frame-renderer'
import type { RuntimePositionCacheContext } from '@/graph/graph/runtime-position-cache'
import type { RuntimeRenderEntryContext } from '@/graph/graph/runtime-render-entry'
import type { RuntimeSimulationControlContext } from '@/graph/graph/runtime-simulation-controls'
import type { RuntimeViewControlContext } from '@/graph/graph/runtime-view-controls'

export function createRuntimeRenderEntryContext (owner: GraphRuntimeContextOwner): RuntimeRenderEntryContext {
  return {
    isDestroyed: () => owner._isDestroyed,
    ensureDevice: callback => owner.ensureDevice(callback),
    config: owner.config,
    graph: owner.graph,
    store: owner.store,
    getCanvas: () => owner.canvas,
    getDevice: () => owner.device,
    isFirstRenderAfterInit: () => owner._isFirstRenderAfterInit,
    setFitViewOnInitTimeoutId: id => { owner._fitViewOnInitTimeoutID = id },
    setFirstRenderAfterInit: value => { owner._isFirstRenderAfterInit = value },
    flatten: pointPositions => owner.flatten(pointPositions),
    fitView: (duration, padding) => owner.fitView(duration, padding),
    fitViewByPointIndices: (indices, duration, padding) => owner.fitViewByPointIndices(indices, duration, padding),
    setZoomTransformByPointPositions: (positions, duration, scale, padding) => owner.setZoomTransformByPointPositions(positions, duration, scale, padding),
    update: simulationAlpha => owner.update(simulationAlpha),
    stopFrames: () => owner.frameLoop.stop(),
    startFrames: () => owner.frameLoop.start(),
    forceHoverDetection: () => { owner.hoverState.shouldForceHoverDetection = true },
  }
}

export function createRuntimeViewControlContext (owner: GraphRuntimeContextOwner): RuntimeViewControlContext {
  return {
    isDestroyed: () => owner._isDestroyed,
    ensureDevice: callback => owner.ensureDevice(callback),
    getDevice: () => owner.device,
    getPoints: () => owner.points,
    getCanvasSelection: () => owner.canvasD3Selection,
    getPointPositions: () => owner.getPointPositions(),
    readbackPointPositions: () => owner.readbackPointPositions(),
    resizeCanvas: () => owner.resizeCanvas(),
    store: owner.store,
    zoomInstance: owner.zoomInstance,
  }
}

export function createRuntimeSimulationControlContext (owner: GraphRuntimeContextOwner): RuntimeSimulationControlContext {
  return {
    isDestroyed: () => owner._isDestroyed,
    ensureDevice: callback => owner.ensureDevice(callback),
    config: owner.config,
    graph: owner.graph,
    store: owner.store,
    hasPointsTexture: () => !!owner.store.pointsTextureSize,
    resetSimulationTicks: () => {
      owner.lastSimTickMs = 0
      owner.lastPhysicsTickMs = Number.NEGATIVE_INFINITY
    },
    runSimulationStep: forceExecution => owner.runSimulationStep(forceExecution),
    requestWebGpuPointPositionsSnapshot: force => owner.requestWebGpuPointPositionsSnapshot(force),
    forceHoverDetection: () => { owner.hoverState.shouldForceHoverDetection = true },
  }
}

export function createRuntimeDataUpdateContext (owner: GraphRuntimeContextOwner): RuntimeDataUpdateContext {
  return {
    config: owner.config,
    graph: owner.graph,
    getPoints: () => owner.points,
    isDestroyed: () => owner._isDestroyed,
    ensureDevice: callback => owner.ensureDevice(callback),
    applyConfigUpdate: prevConfig => owner.applyConfigUpdate(prevConfig),
    markPointPositionsChanged: invalidateKnownPickerData => owner.markPointPositionsChanged(invalidateKnownPickerData),
    markLinksChanged: () => owner.markLinksChanged(),
    setUpdateFlags: flags => { Object.assign(owner, flags) },
  }
}

export function createRuntimeFrameRendererContext (owner: GraphRuntimeContextOwner): RuntimeFrameRendererContext {
  return {
    isDestroyed: owner._isDestroyed,
    config: owner.config,
    graph: owner.graph,
    store: owner.store,
    canvas: owner.canvas,
    device: owner.device,
    points: owner.points,
    lines: owner.lines,
    zoomInstance: owner.zoomInstance,
    isDragActive: owner.dragInstance.isActive,
    timerQueryPool: owner.timerQueryPool,
    msaaTarget: owner.msaaTarget,
    isRenderDirty: owner.isRenderDirty,
    renderDirtyFrameCount: owner.renderDirtyFrameCount,
    currentEvent: owner.currentEvent,
    lastPhysicsTickMs: owner.lastPhysicsTickMs,
    getPositionEpoch: () => owner.webGpuPointPositions.epoch,
    traceDebugFrame: (name, data) => owner.traceDebugFrame(name, data),
    maybeApplyAdaptiveDpr: nowMs => owner.maybeApplyAdaptiveDpr(nowMs),
    resizeCanvas: forceResize => owner.resizeCanvas(forceResize),
    findHoveredItem: () => owner.findHoveredItem(),
    beginFpsMonitor: () => owner.fpsMonitor?.begin(),
    endFpsMonitor: nowMs => owner.fpsMonitor?.end(nowMs),
    runSimulationStep: forceExecution => owner.runSimulationStep(forceExecution),
    resolveRenderPolicy: () => owner.resolveRenderPolicy(),
    markPointPositionsChanged: () => owner.markPointPositionsChanged(),
  }
}

export function createRuntimeCanvasContext (owner: GraphRuntimeContextOwner): RuntimeCanvasContext {
  return {
    isDestroyed: () => owner._isDestroyed,
    config: owner.config,
    store: owner.store,
    canvas: owner.canvas,
    device: owner.device,
    points: owner.points,
    lines: owner.lines,
    zoomInstance: owner.zoomInstance,
    dragInstance: owner.dragInstance,
    canvasD3Selection: owner.canvasD3Selection,
    lastAppliedDpr: owner._lastAppliedDpr,
    lastInteractionMs: owner._lastInteractionMs,
    lastAdaptiveTransformX: owner._lastAdaptiveTransformX,
    lastAdaptiveTransformY: owner._lastAdaptiveTransformY,
    lastAdaptiveTransformK: owner._lastAdaptiveTransformK,
    setAdaptiveState: state => {
      if ('lastAppliedDpr' in state) owner._lastAppliedDpr = state.lastAppliedDpr
      if (state.lastInteractionMs !== undefined) owner._lastInteractionMs = state.lastInteractionMs
      if (state.lastAdaptiveTransformX !== undefined) owner._lastAdaptiveTransformX = state.lastAdaptiveTransformX
      if (state.lastAdaptiveTransformY !== undefined) owner._lastAdaptiveTransformY = state.lastAdaptiveTransformY
      if (state.lastAdaptiveTransformK !== undefined) owner._lastAdaptiveTransformK = state.lastAdaptiveTransformK
    },
    traceDebugFrame: (name, data) => owner.traceDebugFrame(name, data),
  }
}

export function createRuntimePositionCacheContext (owner: GraphRuntimeContextOwner): RuntimePositionCacheContext {
  return {
    config: owner.config,
    graph: owner.graph,
    store: owner.store,
    pointPositions: owner.webGpuPointPositions,
    linkHoverPathCache: owner.linkHoverPathCache,
    isDestroyed: () => owner._isDestroyed,
    isWebGpu: () => owner.device?.info?.type === 'webgpu',
    getPoints: () => owner.points,
    setPointPickerGrid: grid => { owner.webGpuPointPickerGrid = grid },
    setLinkPickerGrid: grid => { owner.webGpuLinkPickerGrid = grid },
  }
}

export function createGraphAccessorContext (owner: GraphRuntimeContextOwner): GraphAccessorContext {
  return {
    isDestroyed: owner._isDestroyed,
    graph: owner.graph,
    points: owner.points,
    lines: owner.lines,
    zoomInstance: owner.zoomInstance,
  }
}

export function createRuntimeSelectionContext (owner: GraphRuntimeContextOwner): RuntimeSelectionContext {
  return {
    isDestroyed: () => owner._isDestroyed,
    isReady: () => owner.isReady,
    ready: owner.ready,
    getDevice: () => owner.device,
    graph: owner.graph,
    getPoints: () => owner.points,
    store: owner.store,
    zoomInstance: owner.zoomInstance,
    getBestKnownWebGpuPointPositions: () => owner.getBestKnownWebGpuPointPositions(),
  }
}
