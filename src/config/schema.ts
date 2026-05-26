/* eslint-disable @typescript-eslint/naming-convention */
import { D3DragEvent } from 'd3-drag'
import { type Hovered } from '@/graph/modules/Store/hovered'
import { type NativeZoomEvent } from '@/graph/modules/Zoom/native'
import { PointShape } from '@/graph/modules/GraphData/point-shape'
import { type RenderLodDepthConfig } from './render-lod-depth'
import { type SimulationConfig } from './simulation'

type RgbaColor = [number, number, number, number]

export interface PublicGraphConfigTypes {
  enableSimulation: boolean;
  backgroundColor: string | RgbaColor;
  spaceSize: number;

  pointDefaultColor: string | RgbaColor;
  pointGreyoutColor?: string | RgbaColor;
  pointGreyoutOpacity?: number;
  pointDefaultSize: number;
  pointDefaultShape: PointShape | `${PointShape}`;
  pointOpacity: number;
  pointSizeScale: number;
  /**
   * Override the engine's auto-derived per-point max size (device px). Lets
   * representations that need oversized points (e.g. photo walls) opt out
   * of the artistic 64-px cap. Leave undefined for default behaviour.
   */
  maxPointSizeOverride?: number;
  hoveredPointCursor: string;
  hoveredLinkCursor: string;
  renderHoveredPointRing: boolean;
  hoveredPointRingColor: string | RgbaColor;
  focusedPointRingColor: string | RgbaColor;
  focusedPointIndex?: number;
  highlightedPointIndices?: number[];
  activePointIndices?: number[];
  outlinedPointIndices?: number[];
  outlinedPointRingColor: string | RgbaColor;

  renderLinks: boolean;
  linkDefaultColor: string | RgbaColor;
  linkOpacity: number;
  linkGreyoutOpacity: number;
  highlightedLinkIndices?: number[];
  activeLinkIndices?: number[];
  focusedLinkIndex?: number;
  focusedLinkWidthIncrease: number;
  linkDefaultWidth: number;
  hoveredLinkColor?: string | RgbaColor;
  hoveredLinkWidthIncrease: number;
  linkWidthScale: number;
  scaleLinksOnZoom: boolean;
  curvedLinks: boolean;
  curvedLinkSegments: number;
  curvedLinkWeight: number;
  curvedLinkControlPointDistance: number;
  linkBundlingStrength: number;
  linkBundlingCellSize: number;
  linkDefaultArrows: boolean;
  linkArrowsSizeScale: number;
  linkVisibilityDistanceRange: number[];
  linkVisibilityMinTransparency: number;

  onClick?: (
    index: number | undefined, pointPosition: [number, number] | undefined, event: MouseEvent
  ) => void;
  onPointClick?: (
    index: number,
    pointPosition: [number, number],
    event: MouseEvent
  ) => void;
  onLinkClick?: (
    linkIndex: number,
    event: MouseEvent
  ) => void;
  onBackgroundClick?: (
    event: MouseEvent
  ) => void;
  onContextMenu?: (
    index: number | undefined, pointPosition: [number, number] | undefined, event: MouseEvent
  ) => void;
  onPointContextMenu?: (
    index: number,
    pointPosition: [number, number],
    event: MouseEvent
  ) => void;
  onLinkContextMenu?: (
    linkIndex: number,
    event: MouseEvent
  ) => void;
  onBackgroundContextMenu?: (
    event: MouseEvent
  ) => void;
  onMouseMove?: (
    index: number | undefined, pointPosition: [number, number] | undefined, event: MouseEvent
  ) => void;
  onPointMouseOver?: (
    index: number,
    pointPosition: [number, number],
    event: MouseEvent | D3DragEvent<HTMLCanvasElement, undefined, Hovered> | NativeZoomEvent | undefined,
    isHighlighted: boolean,
    isOutlined: boolean
  ) => void;
  onPointMouseOut?: (event: MouseEvent | NativeZoomEvent | D3DragEvent<HTMLCanvasElement, undefined, Hovered> | undefined) => void;
  onLinkMouseOver?: (linkIndex: number) => void;
  onLinkMouseOut?: (event: MouseEvent | NativeZoomEvent | D3DragEvent<HTMLCanvasElement, undefined, Hovered> | undefined) => void;
  onZoomStart?: (e: NativeZoomEvent, userDriven: boolean) => void;
  onZoom?: (e: NativeZoomEvent, userDriven: boolean) => void;
  onZoomEnd?: (e: NativeZoomEvent, userDriven: boolean) => void;
  onDragStart?: (e: D3DragEvent<HTMLCanvasElement, undefined, Hovered>) => void;
  onDrag?: (e: D3DragEvent<HTMLCanvasElement, undefined, Hovered>) => void;
  onDragEnd?: (e: D3DragEvent<HTMLCanvasElement, undefined, Hovered>) => void;

  showFPSMonitor: boolean;
  useWebGPU: boolean;
  enableGpuTimings: boolean;
  disableIdleFrameSkip: boolean;
  pixelRatio: number;
  adaptivePixelRatio: boolean | number;
  adaptivePixelRatioSettleMs: number;
  msaa: 1 | 4;
  scalePointsOnZoom: boolean;
  initialZoomLevel?: number;
  enableZoom: boolean;
  minZoomLevel: number;
  maxZoomLevel: number;
  constrainCameraToGraph: boolean;
  cameraBoundsPadding: number;
  enableSimulationDuringZoom: boolean;
  enableDrag: boolean;
  fitViewOnInit: boolean;
  fitViewDelay: number;
  fitViewPadding: number;
  fitViewDuration: number;
  fitViewByPointsInRect?: [[number, number], [number, number]] | [number, number][];
  fitViewByPointIndices?: number[];
  randomSeed?: number | string;
  pointSamplingDistance: number;
  linkSamplingDistance: number;
  rescalePositions?: boolean | undefined;
  attribution: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface GraphConfigInterface extends PublicGraphConfigTypes, RenderLodDepthConfig, SimulationConfig {}

/**
 * Configuration options for the Graph constructor and `setConfig()` method.
 * All properties are optional — any omitted properties will use their default values.
 *
 * Note: calling `setConfig()` fully resets the configuration to defaults before
 * applying the provided values. Properties not included in the call will revert
 * to their defaults, not retain their previous values.
 */
export type GraphConfig = Partial<GraphConfigInterface>
