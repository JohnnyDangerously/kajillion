import type { Device } from '@luma.gl/core'
import type { D3DragEvent } from 'd3-drag'

import type { GraphConfigInterface } from '@/graph/config'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Lines } from '@/graph/modules/Lines'
import type { Points } from '@/graph/modules/Points'
import type { Hovered, Store } from '@/graph/modules/Store'
import type { NativeZoomEvent } from '@/graph/modules/Zoom'
import type { LinkHoverPathCache } from '@/graph/graph/hover-picking'
import type { WebGpuLinkPickerGrid, WebGpuPointPickerGrid } from '@/graph/graph/runtime-contracts'
import type { PointPositionReadbackCache } from '@/graph/graph/readback/point-position-readback-cache'

export type HoverRuntimeEvent = NativeZoomEvent | D3DragEvent<HTMLCanvasElement, undefined, Hovered> | MouseEvent | undefined

export interface HoverRuntimeState {
  findHoveredItemExecutionCount: number;
  isMouseOnCanvas: boolean;
  lastMouseX: number;
  lastMouseY: number;
  lastCheckedMouseX: number;
  lastCheckedMouseY: number;
  shouldForceHoverDetection: boolean;
}

export interface HoverRuntimeContext {
  isDestroyed: boolean;
  canvas: HTMLCanvasElement;
  config: GraphConfigInterface;
  graph: GraphData;
  store: Store;
  device: Device | undefined;
  points: Points | undefined;
  lines: Lines | undefined;
  pointPositions: PointPositionReadbackCache;
  linkHoverPathCache: LinkHoverPathCache;
  currentEvent: HoverRuntimeEvent;
  isDragActive: boolean;
  hoverState: HoverRuntimeState;
  getPointPickerGrid: () => WebGpuPointPickerGrid | undefined;
  getLinkPickerGrid: () => WebGpuLinkPickerGrid | undefined;
  rebuildPointPickerGrid: (positions: Float32Array) => void;
  rebuildLinkPickerGrid: (positions: Float32Array) => void;
  requestPointPositionsSnapshot: (force?: boolean) => void;
  transform: {
    x: number;
    y: number;
    k: number;
  };
}
