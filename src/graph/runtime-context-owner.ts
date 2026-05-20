import type { Device } from '@luma.gl/core'
import type { D3DragEvent } from 'd3-drag'
import type { Selection } from 'd3-selection'

import type { GraphConfigInterface } from '@/graph/config'
import type { Clusters } from '@/graph/modules/Clusters'
import type { Drag } from '@/graph/modules/Drag'
import type { FPSMonitor } from '@/graph/modules/FPSMonitor'
import type { ForceCenter } from '@/graph/modules/ForceCenter'
import type { ForceGravity } from '@/graph/modules/ForceGravity'
import type { ForceLink } from '@/graph/modules/ForceLink'
import type { ForceManyBody } from '@/graph/modules/ForceManyBody'
import type { ForceMouse } from '@/graph/modules/ForceMouse'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Lines } from '@/graph/modules/Lines'
import type { Points } from '@/graph/modules/Points'
import type { Hovered, Store } from '@/graph/modules/Store'
import type { NativeZoomEvent, Zoom } from '@/graph/modules/Zoom'
import type { ITimerQueryPool } from '@/graph/perf'
import type { LinkHoverPathCache } from '@/graph/graph/hover-picking'
import type { HoverRuntimeState } from '@/graph/graph/hover-runtime'
import type { PointPositionReadbackCache } from '@/graph/graph/readback/point-position-readback-cache'
import type { RuntimeFrameLoopController } from '@/graph/graph/runtime-frame-loop-controller'
import type { RuntimeFrameRendererContext } from '@/graph/graph/runtime-frame-renderer'
import type { WebGpuLinkPickerGrid, WebGpuPointPickerGrid } from '@/graph/graph/runtime-contracts'
import type { MsaaTarget } from '@/graph/render/msaa-target'

export type RuntimeEvent = NativeZoomEvent | D3DragEvent<HTMLCanvasElement, undefined, Hovered> | MouseEvent | undefined

export interface GraphRuntimeContextOwner {
  _isDestroyed: boolean;
  _isFirstRenderAfterInit: boolean;
  _fitViewOnInitTimeoutID: number | undefined;
  _lastAppliedDpr: number | undefined;
  _lastInteractionMs: number;
  _lastAdaptiveTransformX: number;
  _lastAdaptiveTransformY: number;
  _lastAdaptiveTransformK: number;
  canvas: HTMLCanvasElement;
  canvasD3Selection: Selection<HTMLCanvasElement, undefined, null, undefined> | undefined;
  config: GraphConfigInterface;
  graph: GraphData;
  store: Store;
  device: Device | undefined;
  points: Points | undefined;
  lines: Lines | undefined;
  forceGravity: ForceGravity | undefined;
  forceCenter: ForceCenter | undefined;
  forceManyBody: ForceManyBody | undefined;
  forceLinkIncoming: ForceLink | undefined;
  forceLinkOutgoing: ForceLink | undefined;
  forceMouse: ForceMouse | undefined;
  clusters: Clusters | undefined;
  zoomInstance: Zoom;
  dragInstance: Drag;
  fpsMonitor: FPSMonitor | undefined;
  timerQueryPool: ITimerQueryPool | undefined;
  msaaTarget: MsaaTarget | undefined;
  isRenderDirty: boolean;
  renderDirtyFrameCount: number;
  currentEvent: RuntimeEvent;
  lastPhysicsTickMs: number;
  lastSimTickMs: number;
  webGpuPointPositions: PointPositionReadbackCache;
  webGpuPointPickerGrid: WebGpuPointPickerGrid | undefined;
  webGpuLinkPickerGrid: WebGpuLinkPickerGrid | undefined;
  linkHoverPathCache: LinkHoverPathCache;
  hoverState: HoverRuntimeState;
  frameLoop: RuntimeFrameLoopController;
  ready: Promise<void>;
  isReady: boolean;
  ensureDevice: (callback: () => void) => boolean;
  flatten: (pointPositions: [number, number][]) => number[];
  fitView: (duration?: number, padding?: number, enableSimulation?: boolean) => void;
  fitViewByPointIndices: (indices: number[], duration?: number, padding?: number, enableSimulation?: boolean) => void;
  setZoomTransformByPointPositions: (positions: Float32Array, duration?: number, scale?: number, padding?: number, enableSimulation?: boolean) => void;
  update: (simulationAlpha?: number) => void;
  resizeCanvas: (forceResize?: boolean) => void;
  applyConfigUpdate: (prevConfig: GraphConfigInterface) => void;
  markPointPositionsChanged: (invalidateKnownPickerData?: boolean) => void;
  markLinksChanged: () => void;
  traceDebugFrame: (name: string, data?: Record<string, unknown>) => void;
  maybeApplyAdaptiveDpr: (nowMs: number) => boolean;
  runSimulationStep: (forceExecution?: boolean) => void;
  resolveRenderPolicy: RuntimeFrameRendererContext['resolveRenderPolicy'];
  readbackPointPositions: () => Promise<Float32Array>;
  getPointPositions: () => number[];
  requestWebGpuPointPositionsSnapshot: (force?: boolean) => void;
  getBestKnownWebGpuPointPositions: () => Float32Array | undefined;
  getZoomDistance: () => number;
  markRenderDirty: (frames?: number) => void;
  applyEffectivePixelRatio: (ratio: number) => boolean;
  updateZoomDragBehaviors: () => void;
  findHoveredItem: () => void;
}
