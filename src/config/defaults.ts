import { PointShape } from '@/graph/modules/GraphData/point-shape'
import { renderLodDepthDefaultConfigValues } from './render-lod-depth'
import { simulationDefaultConfigValues } from './simulation'
import { type GraphConfigInterface } from './schema'
import { type Complete } from './validation'

/**
 * Default values for all graph configuration properties.
 */
export const defaultConfigValues = {
  // General
  enableSimulation: true,
  backgroundColor: '#222222',
  /** Setting to 4096 because larger values crash the graph on iOS. More info: https://github.com/cosmosgl/graph/issues/203 */
  spaceSize: 4096,

  // Points
  pointDefaultColor: '#b3b3b3',
  pointDefaultSize: 4,
  pointDefaultShape: PointShape.Circle,
  pointOpacity: 1.0,
  pointGreyoutOpacity: undefined,
  pointGreyoutColor: undefined,
  pointSizeScale: 1,
  maxPointSizeOverride: undefined,
  scalePointsOnZoom: false,

  // Point interaction
  hoveredPointCursor: 'auto',
  renderHoveredPointRing: false,
  hoveredPointRingColor: 'white',
  focusedPointRingColor: 'white',
  focusedPointIndex: undefined,
  highlightedPointIndices: undefined,
  activePointIndices: undefined,
  outlinedPointIndices: undefined,
  outlinedPointRingColor: 'white',

  // Links
  renderLinks: true,
  linkDefaultColor: '#666666',
  linkDefaultWidth: 1,
  linkOpacity: 1.0,
  linkGreyoutOpacity: 0.1,
  linkWidthScale: 1,
  scaleLinksOnZoom: false,
  curvedLinks: false,
  curvedLinkSegments: 19,
  curvedLinkWeight: 0.8,
  curvedLinkControlPointDistance: 0.5,
  linkBundlingStrength: 0,
  linkBundlingCellSize: 320,
  linkDefaultArrows: false,
  linkArrowsSizeScale: 1,
  linkVisibilityDistanceRange: [50, 150],
  linkVisibilityMinTransparency: 0.25,

  // Render, LOD, and depth treatment
  ...renderLodDepthDefaultConfigValues,

  // Link interaction
  hoveredLinkCursor: 'auto',
  hoveredLinkColor: undefined,
  hoveredLinkWidthIncrease: 5,
  highlightedLinkIndices: undefined,
  activeLinkIndices: undefined,
  focusedLinkIndex: undefined,
  focusedLinkWidthIncrease: 5,

  // Simulation
  ...simulationDefaultConfigValues,

  // Interaction callbacks
  onClick: undefined,
  onPointClick: undefined,
  onLinkClick: undefined,
  onBackgroundClick: undefined,
  onContextMenu: undefined,
  onPointContextMenu: undefined,
  onLinkContextMenu: undefined,
  onBackgroundContextMenu: undefined,
  onMouseMove: undefined,
  onPointMouseOver: undefined,
  onPointMouseOut: undefined,
  onLinkMouseOver: undefined,
  onLinkMouseOut: undefined,

  // Zoom and pan callbacks
  onZoomStart: undefined,
  onZoom: undefined,
  onZoomEnd: undefined,

  // Drag callbacks
  onDragStart: undefined,
  onDrag: undefined,
  onDragEnd: undefined,

  // Display
  showFPSMonitor: false,
  useWebGPU: false,
  enableGpuTimings: false,
  disableIdleFrameSkip: false,
  pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2,
  adaptivePixelRatio: true,
  adaptivePixelRatioSettleMs: 150,
  msaa: 1,

  // Zoom and pan
  enableZoom: true,
  minZoomLevel: 0.001,
  maxZoomLevel: Infinity,
  constrainCameraToGraph: false,
  cameraBoundsPadding: 0.35,
  enableSimulationDuringZoom: false,
  initialZoomLevel: undefined,

  // Drag
  enableDrag: false,

  // Fit view
  fitViewOnInit: true,
  fitViewDelay: 250,
  fitViewPadding: 0.1,
  fitViewDuration: 250,
  fitViewByPointsInRect: undefined,
  fitViewByPointIndices: undefined,

  // Sampling
  pointSamplingDistance: 100,
  linkSamplingDistance: 100,

  // Miscellaneous
  randomSeed: undefined,
  rescalePositions: undefined,
  attribution: '',
} satisfies Complete<GraphConfigInterface>

// Internal constants (not part of GraphConfigInterface)
export const hoveredPointRingOpacity = 0.7
export const focusedPointRingOpacity = 0.95
