import type { Device } from '@luma.gl/core'
import type { D3DragEvent } from 'd3-drag'
import type { Selection } from 'd3-selection'

import { type GraphConfigInterface } from '@/graph/config'
import { type ForceCenter } from '@/graph/modules/ForceCenter'
import { type ForceGravity } from '@/graph/modules/ForceGravity'
import { type ForceLink } from '@/graph/modules/ForceLink'
import { type ForceManyBody } from '@/graph/modules/ForceManyBody'
import { type ForceMouse } from '@/graph/modules/ForceMouse'
import { type Clusters } from '@/graph/modules/Clusters'
import { type FPSMonitor } from '@/graph/modules/FPSMonitor'
import { GraphData } from '@/graph/modules/GraphData'
import { type Lines } from '@/graph/modules/Lines'
import { type Points } from '@/graph/modules/Points'
import { type Hovered, Store } from '@/graph/modules/Store'
import { type NativeZoomEvent, Zoom } from '@/graph/modules/Zoom'
import { Drag } from '@/graph/modules/Drag'
import { type ITimerQueryPool } from '@/graph/perf'
import { MsaaTarget } from '@/graph/render/msaa-target'
import { type ResolvedRenderPolicy } from '@/graph/render/resolveAdaptiveRenderPolicy'
import { PointPositionReadbackCache } from '@/graph/graph/readback/point-position-readback-cache'
import { type LinkHoverPathCache } from '@/graph/graph/hover-picking'
import { type HoverRuntimeState } from '@/graph/graph/hover-runtime'
import type { RuntimeCanvasContext } from '@/graph/graph/runtime-canvas'
import {
  type DebugFrameTraceEvent,
  type WebGpuLinkPickerGrid,
  type WebGpuPointPickerGrid,
} from '@/graph/graph/runtime-contracts'
import { RuntimeFrameLoopController } from '@/graph/graph/runtime-frame-loop-controller'
import type { RuntimeFrameRendererContext } from '@/graph/graph/runtime-frame-renderer'
import type { RuntimePositionCacheContext } from '@/graph/graph/runtime-position-cache'
import type { RuntimeSimulationControlContext } from '@/graph/graph/runtime-simulation-controls'

export interface GraphRuntimeFields {
  _fitViewOnInitTimeoutID: number | undefined;
  _isDestroyed: boolean;
  _isFirstRenderAfterInit: boolean;
  _lastAdaptiveTransformK: number;
  _lastAdaptiveTransformX: number;
  _lastAdaptiveTransformY: number;
  _lastAppliedDpr: number | undefined;
  _lastInteractionMs: number;
  attributionDivElement: HTMLElement | undefined;
  canvas: HTMLCanvasElement;
  canvasD3Selection: Selection<HTMLCanvasElement, undefined, null, undefined> | undefined;
  clusters: Clusters | undefined;
  currentEvent: NativeZoomEvent | D3DragEvent<HTMLCanvasElement, undefined, Hovered> | MouseEvent | undefined;
  debugFrameTrace: DebugFrameTraceEvent[];
  debugFrameTraceLimit: number;
  device: Device | undefined;
  dragInstance: Drag;
  forceCenter: ForceCenter | undefined;
  forceGravity: ForceGravity | undefined;
  forceLinkIncoming: ForceLink | undefined;
  forceLinkOutgoing: ForceLink | undefined;
  forceManyBody: ForceManyBody | undefined;
  forceMouse: ForceMouse | undefined;
  fpsMonitor: FPSMonitor | undefined;
  frameLoop: RuntimeFrameLoopController;
  hoverState: HoverRuntimeState;
  isForceCenterUpdateNeeded: boolean;
  isForceLinkUpdateNeeded: boolean;
  isForceManyBodyUpdateNeeded: boolean;
  isLinkArrowUpdateNeeded: boolean;
  isLinkColorUpdateNeeded: boolean;
  isLinkWidthUpdateNeeded: boolean;
  isLinksUpdateNeeded: boolean;
  isPointClusterUpdateNeeded: boolean;
  isPointColorUpdateNeeded: boolean;
  isPointImageIndicesUpdateNeeded: boolean;
  isPointImageSizesUpdateNeeded: boolean;
  isPointImpostorAutoActive: boolean;
  isPointPositionsUpdateNeeded: boolean;
  isPointShapeUpdateNeeded: boolean;
  isPointSizeUpdateNeeded: boolean;
  isRenderDirty: boolean;
  isRightClickMouse: boolean;
  lastPhysicsTickMs: number;
  lastSimTickMs: number;
  lines: Lines | undefined;
  linkHoverPathCache: LinkHoverPathCache;
  msaaTarget: MsaaTarget | undefined;
  points: Points | undefined;
  renderDirtyFrameCount: number;
  resolvedRenderPolicy: ResolvedRenderPolicy | undefined;
  simFrameCounter: number;
  store: Store;
  timerQueryPool: ITimerQueryPool | undefined;
  webGpuLinkPickerGrid: WebGpuLinkPickerGrid | undefined;
  webGpuPointPickerGrid: WebGpuPointPickerGrid | undefined;
  webGpuPointPositions: PointPositionReadbackCache;
  zoomInstance: Zoom;
}

export interface GraphRuntimeMethods {
  applyConfigUpdate: (prevConfig: GraphConfigInterface) => void;
  applyEffectivePixelRatio: (ratio: number) => boolean;
  end: () => void;
  ensureDevice: (callback: () => void) => boolean;
  findHoveredItem: () => void;
  getBestKnownWebGpuPointPositions: () => Float32Array | undefined;
  initPrograms: () => void;
  markLinksChanged: () => void;
  markPointPositionsChanged: (invalidateKnownPickerData?: boolean) => void;
  markRenderDirty: (frames?: number) => void;
  maybeApplyAdaptiveDpr: (nowMs: number) => boolean;
  onWebGpuPointPositionsCached: (positions: Float32Array) => void;
  rebuildWebGpuLinkPickerGrid: (positions: Float32Array) => void;
  rebuildWebGpuPointPickerGrid: (positions: Float32Array) => void;
  renderFrame: (now?: number) => void;
  requestWebGpuPointPositionsSnapshot: (force?: boolean) => void;
  resizeCanvas: (forceResize?: boolean) => void;
  resolveRenderPolicy: () => ResolvedRenderPolicy;
  runSimulationStep: (forceExecution?: boolean) => void;
  traceDebugFrame: (name: string, data?: Record<string, unknown>) => void;
  update: (simulationAlpha?: number) => void;
  updateZoomDragBehaviors: () => void;
}

export interface GraphRuntimeShellOwner extends GraphRuntimeFields, GraphRuntimeMethods {
  config: GraphConfigInterface;
  graph: GraphData;
  isReady: boolean;
  ready: Promise<void>;
  create: () => void;
  getCanvasContext: () => RuntimeCanvasContext;
  getFrameRendererContext: () => RuntimeFrameRendererContext;
  getPositionCacheContext: () => RuntimePositionCacheContext;
  getSimulationControlContext: () => RuntimeSimulationControlContext;
}
