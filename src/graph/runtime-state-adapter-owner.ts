import type { Device } from '@luma.gl/core'
import type { D3DragEvent } from 'd3-drag'

import type { GraphConfigInterface } from '@/graph/config'
import type { LinkHoverPathCache } from '@/graph/graph/hover-picking'
import type { HoverRuntimeState } from '@/graph/graph/hover-runtime'
import type { PointPositionReadbackCache } from '@/graph/graph/readback/point-position-readback-cache'
import type { DebugFrameTraceEvent, WebGpuLinkPickerGrid, WebGpuPointPickerGrid } from '@/graph/graph/runtime-contracts'
import type { RuntimeFrameLoopController } from '@/graph/graph/runtime-frame-loop-controller'
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
import type { ResolvedRenderPolicy } from '@/graph/render/resolveAdaptiveRenderPolicy'

export interface GraphStateAdapterOwner {
  _isDestroyed: boolean;
  _lastAppliedDpr: number | undefined;
  canvas: HTMLCanvasElement;
  clusters: Clusters | undefined;
  config: GraphConfigInterface;
  currentEvent: NativeZoomEvent | D3DragEvent<HTMLCanvasElement, undefined, Hovered> | MouseEvent | undefined;
  debugFrameTrace: DebugFrameTraceEvent[];
  debugFrameTraceLimit: number;
  device: Device | undefined;
  dragInstance: Drag;
  forceCenter: ForceCenter | undefined; forceGravity: ForceGravity | undefined;
  forceLinkIncoming: ForceLink | undefined; forceLinkOutgoing: ForceLink | undefined;
  forceManyBody: ForceManyBody | undefined; forceMouse: ForceMouse | undefined;
  fpsMonitor: FPSMonitor | undefined;
  frameLoop: RuntimeFrameLoopController;
  graph: GraphData;
  hoverState: HoverRuntimeState;
  isLinkArrowUpdateNeeded: boolean; isLinkColorUpdateNeeded: boolean;
  isLinkWidthUpdateNeeded: boolean; isLinksUpdateNeeded: boolean;
  isPointClusterUpdateNeeded: boolean; isPointColorUpdateNeeded: boolean;
  isPointImageIndicesUpdateNeeded: boolean; isPointImageSizesUpdateNeeded: boolean;
  isPointImpostorAutoActive: boolean;
  isPointPositionsUpdateNeeded: boolean; isPointShapeUpdateNeeded: boolean;
  isPointSizeUpdateNeeded: boolean;
  isRenderDirty: boolean;
  isRightClickMouse: boolean;
  isForceCenterUpdateNeeded: boolean; isForceLinkUpdateNeeded: boolean;
  isForceManyBodyUpdateNeeded: boolean;
  lastSimTickMs: number;
  lines: Lines | undefined;
  linkHoverPathCache: LinkHoverPathCache;
  points: Points | undefined;
  renderDirtyFrameCount: number;
  resolvedRenderPolicy: ResolvedRenderPolicy | undefined;
  simFrameCounter: number;
  store: Store;
  timerQueryPool: ITimerQueryPool | undefined;
  webGpuLinkPickerGrid: WebGpuLinkPickerGrid | undefined; webGpuPointPickerGrid: WebGpuPointPickerGrid | undefined;
  webGpuPointPositions: PointPositionReadbackCache;
  zoomInstance: Zoom;
  applyEffectivePixelRatio: (ratio: number) => boolean;
  markLinksChanged: () => void;
  markPointPositionsChanged: () => void;
  markRenderDirty: () => void;
  maybeApplyAdaptiveDpr: (nowMs: number) => boolean;
  rebuildWebGpuLinkPickerGrid: (positions: Float32Array) => void; rebuildWebGpuPointPickerGrid: (positions: Float32Array) => void;
  requestWebGpuPointPositionsSnapshot: (force?: boolean) => void;
  resizeCanvas: (forceResize?: boolean) => void;
  update: (simulationAlpha?: number) => void;
  updateZoomDragBehaviors: () => void;
  getZoomDistance: () => number;
}
