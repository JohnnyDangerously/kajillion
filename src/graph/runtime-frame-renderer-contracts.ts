import type { Device } from '@luma.gl/core'
import type { D3DragEvent } from 'd3-drag'

import type { GraphConfigInterface } from '@/graph/config'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Lines } from '@/graph/modules/Lines'
import type { Points } from '@/graph/modules/Points'
import type { Hovered, Store } from '@/graph/modules/Store'
import type { NativeZoomEvent, Zoom } from '@/graph/modules/Zoom'
import type { ITimerQueryPool } from '@/graph/perf'
import type { ResolvedRenderPolicy } from '@/graph/render/resolveAdaptiveRenderPolicy'
import type { MsaaTarget } from '@/graph/render/msaa-target'

export type RuntimeFrameCurrentEvent = NativeZoomEvent | D3DragEvent<HTMLCanvasElement, undefined, Hovered> | MouseEvent | undefined

export interface RuntimeFrameRendererContext {
  isDestroyed: boolean;
  config: GraphConfigInterface;
  graph: GraphData;
  store: Store;
  canvas: HTMLCanvasElement;
  device: Device | undefined;
  points: Points | undefined;
  lines: Lines | undefined;
  zoomInstance: Pick<Zoom, 'isRunning'>;
  isDragActive: boolean;
  timerQueryPool: ITimerQueryPool | undefined;
  msaaTarget: MsaaTarget | undefined;
  isRenderDirty: boolean;
  renderDirtyFrameCount: number;
  currentEvent: RuntimeFrameCurrentEvent;
  lastPhysicsTickMs: number;
  getPositionEpoch: () => number;
  traceDebugFrame: (name: string, data?: Record<string, unknown>) => void;
  maybeApplyAdaptiveDpr: (nowMs: number) => boolean;
  resizeCanvas: (forceResize?: boolean) => void;
  findHoveredItem: () => void;
  beginFpsMonitor: () => void;
  endFpsMonitor: (nowMs: number) => void;
  runSimulationStep: (forceExecution?: boolean) => void;
  resolveRenderPolicy: () => ResolvedRenderPolicy;
  markPointPositionsChanged: () => void;
}

export interface RuntimeFrameRendererState {
  msaaTarget: MsaaTarget | undefined;
  isRenderDirty: boolean;
  renderDirtyFrameCount: number;
  currentEvent: RuntimeFrameCurrentEvent;
  lastPhysicsTickMs: number;
}
