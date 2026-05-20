import 'd3-transition'
import type { Device } from '@luma.gl/core'

import { type GraphConfig, type GraphConfigInterface } from '@/graph/config'
import type { GraphData } from '@/graph/modules/GraphData'
import { GraphRuntimeSimulationApi } from '@/graph/graph/runtime-simulation-api'
import {
  createGraphLifecycle,
  destroyGraphLifecycle,
  type GraphLifecycleOwner,
} from '@/graph/graph/runtime-lifecycle'
import {
  applyGraphPendingUpdates,
  type GraphStateAdapterOwner,
} from '@/graph/graph/runtime-state-adapters'
import {
  initializeGraphRuntimeShell,
  installGraphRuntimeMethods,
  type GraphRuntimeFields,
  type GraphRuntimeMethods,
  type GraphRuntimeShellOwner,
} from '@/graph/graph/runtime-shell'

export class Graph extends GraphRuntimeSimulationApi {
  public declare config: GraphConfigInterface
  public declare graph: GraphData
  public readonly ready: Promise<void>
  public declare isReady: boolean
  private readonly deviceInitPromise: Promise<Device>
  private shouldDestroyDevice: boolean

  private declare canvas: GraphRuntimeFields['canvas']; private declare attributionDivElement: GraphRuntimeFields['attributionDivElement']
  private declare canvasD3Selection: GraphRuntimeFields['canvasD3Selection']; private declare device: GraphRuntimeFields['device']
  private declare isRightClickMouse: GraphRuntimeFields['isRightClickMouse']; private declare isRenderDirty: GraphRuntimeFields['isRenderDirty']
  private declare renderDirtyFrameCount: GraphRuntimeFields['renderDirtyFrameCount']; private declare isPointImpostorAutoActive: GraphRuntimeFields['isPointImpostorAutoActive']
  private declare resolvedRenderPolicy: GraphRuntimeFields['resolvedRenderPolicy']; private declare debugFrameTrace: GraphRuntimeFields['debugFrameTrace']
  private declare debugFrameTraceLimit: GraphRuntimeFields['debugFrameTraceLimit']; private declare simFrameCounter: GraphRuntimeFields['simFrameCounter']
  private declare store: GraphRuntimeFields['store']; private declare points: GraphRuntimeFields['points']; private declare lines: GraphRuntimeFields['lines']
  private declare forceGravity: GraphRuntimeFields['forceGravity']; private declare forceCenter: GraphRuntimeFields['forceCenter']
  private declare forceManyBody: GraphRuntimeFields['forceManyBody']; private declare forceLinkIncoming: GraphRuntimeFields['forceLinkIncoming']
  private declare forceLinkOutgoing: GraphRuntimeFields['forceLinkOutgoing']; private declare forceMouse: GraphRuntimeFields['forceMouse']
  private declare clusters: GraphRuntimeFields['clusters']; private declare zoomInstance: GraphRuntimeFields['zoomInstance']; private declare dragInstance: GraphRuntimeFields['dragInstance']
  private declare fpsMonitor: GraphRuntimeFields['fpsMonitor']; private declare _lastAppliedDpr: GraphRuntimeFields['_lastAppliedDpr']
  private declare _lastInteractionMs: GraphRuntimeFields['_lastInteractionMs']; private declare _lastAdaptiveTransformX: GraphRuntimeFields['_lastAdaptiveTransformX']
  private declare _lastAdaptiveTransformY: GraphRuntimeFields['_lastAdaptiveTransformY']; private declare _lastAdaptiveTransformK: GraphRuntimeFields['_lastAdaptiveTransformK']
  private declare timerQueryPool: GraphRuntimeFields['timerQueryPool']; private declare msaaTarget: GraphRuntimeFields['msaaTarget']
  private declare lastPhysicsTickMs: GraphRuntimeFields['lastPhysicsTickMs']; private declare lastSimTickMs: GraphRuntimeFields['lastSimTickMs']
  private declare webGpuPointPositions: GraphRuntimeFields['webGpuPointPositions']; private declare webGpuPointPickerGrid: GraphRuntimeFields['webGpuPointPickerGrid']
  private declare webGpuLinkPickerGrid: GraphRuntimeFields['webGpuLinkPickerGrid']; private declare linkHoverPathCache: GraphRuntimeFields['linkHoverPathCache']
  private declare currentEvent: GraphRuntimeFields['currentEvent']; private declare hoverState: GraphRuntimeFields['hoverState']
  private declare _isFirstRenderAfterInit: GraphRuntimeFields['_isFirstRenderAfterInit']; private declare _fitViewOnInitTimeoutID: GraphRuntimeFields['_fitViewOnInitTimeoutID']
  private declare isPointPositionsUpdateNeeded: GraphRuntimeFields['isPointPositionsUpdateNeeded']; private declare isPointColorUpdateNeeded: GraphRuntimeFields['isPointColorUpdateNeeded']
  private declare isPointSizeUpdateNeeded: GraphRuntimeFields['isPointSizeUpdateNeeded']; private declare isPointShapeUpdateNeeded: GraphRuntimeFields['isPointShapeUpdateNeeded']
  private declare isPointImageIndicesUpdateNeeded: GraphRuntimeFields['isPointImageIndicesUpdateNeeded']; private declare isLinksUpdateNeeded: GraphRuntimeFields['isLinksUpdateNeeded']
  private declare isLinkColorUpdateNeeded: GraphRuntimeFields['isLinkColorUpdateNeeded']; private declare isLinkWidthUpdateNeeded: GraphRuntimeFields['isLinkWidthUpdateNeeded']
  private declare isLinkArrowUpdateNeeded: GraphRuntimeFields['isLinkArrowUpdateNeeded']; private declare isPointClusterUpdateNeeded: GraphRuntimeFields['isPointClusterUpdateNeeded']
  private declare isForceManyBodyUpdateNeeded: GraphRuntimeFields['isForceManyBodyUpdateNeeded']; private declare isForceLinkUpdateNeeded: GraphRuntimeFields['isForceLinkUpdateNeeded']
  private declare isForceCenterUpdateNeeded: GraphRuntimeFields['isForceCenterUpdateNeeded']; private declare isPointImageSizesUpdateNeeded: GraphRuntimeFields['isPointImageSizesUpdateNeeded']
  private declare _isDestroyed: GraphRuntimeFields['_isDestroyed']; private declare frameLoop: GraphRuntimeFields['frameLoop']

  private declare applyConfigUpdate: GraphRuntimeMethods['applyConfigUpdate']; private declare ensureDevice: GraphRuntimeMethods['ensureDevice']
  private declare traceDebugFrame: GraphRuntimeMethods['traceDebugFrame']; private declare markPointPositionsChanged: GraphRuntimeMethods['markPointPositionsChanged']
  private declare markLinksChanged: GraphRuntimeMethods['markLinksChanged']; private declare markRenderDirty: GraphRuntimeMethods['markRenderDirty']
  private declare resolveRenderPolicy: GraphRuntimeMethods['resolveRenderPolicy']; private declare onWebGpuPointPositionsCached: GraphRuntimeMethods['onWebGpuPointPositionsCached']
  private declare requestWebGpuPointPositionsSnapshot: GraphRuntimeMethods['requestWebGpuPointPositionsSnapshot']; private declare rebuildWebGpuPointPickerGrid: GraphRuntimeMethods['rebuildWebGpuPointPickerGrid']
  private declare rebuildWebGpuLinkPickerGrid: GraphRuntimeMethods['rebuildWebGpuLinkPickerGrid']; private declare getBestKnownWebGpuPointPositions: GraphRuntimeMethods['getBestKnownWebGpuPointPositions']
  private declare update: GraphRuntimeMethods['update']; private declare runSimulationStep: GraphRuntimeMethods['runSimulationStep']; private declare initPrograms: GraphRuntimeMethods['initPrograms']
  private declare applyEffectivePixelRatio: GraphRuntimeMethods['applyEffectivePixelRatio']; private declare maybeApplyAdaptiveDpr: GraphRuntimeMethods['maybeApplyAdaptiveDpr']
  private declare renderFrame: GraphRuntimeMethods['renderFrame']; private declare end: GraphRuntimeMethods['end']; private declare resizeCanvas: GraphRuntimeMethods['resizeCanvas']
  private declare updateZoomDragBehaviors: GraphRuntimeMethods['updateZoomDragBehaviors']; private declare findHoveredItem: GraphRuntimeMethods['findHoveredItem']

  public constructor (
    div: HTMLDivElement,
    config?: GraphConfig,
    devicePromise?: Promise<Device>
  ) {
    super()
    initializeGraphRuntimeShell(this as unknown as GraphRuntimeShellOwner)
    const lifecycle = createGraphLifecycle(this as unknown as GraphLifecycleOwner, div, config, devicePromise)
    this.deviceInitPromise = lifecycle.deviceInitPromise
    this.shouldDestroyDevice = lifecycle.shouldDestroyDevice
    this.ready = lifecycle.ready
  }

  public destroy (): void {
    destroyGraphLifecycle(this as unknown as GraphLifecycleOwner)
  }

  public create (): void {
    if (this._isDestroyed) return
    if (this.ensureDevice(() => this.create())) return
    applyGraphPendingUpdates(this as unknown as GraphStateAdapterOwner)
  }
}

installGraphRuntimeMethods(Graph as unknown as { prototype: GraphRuntimeShellOwner })
