import type { DemoConfig } from '../../control-plane/types'
import type { WorkGraphData } from '../../demo-lifecycle/work-graph-types'
import type { WorkFocusState } from '../work-focus-panel'
import type { GeneratedGraph } from '../../../generate-graph'
import type { RenderableGraphData } from '../../../graph-contract'

export type VisualAttributes = {
  pointColors: Float32Array;
  pointSizes: Float32Array;
  pointShapes: Float32Array;
  linkColors: Float32Array;
  linkWidths: Float32Array;
}

export type VisualAttributeOptions = {
  config: DemoConfig;
  equalizationZoomDistance: number;
  overviewZoomDistance: number;
  workFocusState?: WorkFocusState;
  spaceSize?: number;
}

export type VisualAttributeData = GeneratedGraph | RenderableGraphData

export type VisualAttributeContext = {
  config: DemoConfig;
  isLight: boolean;
  isDense: boolean;
  isWork: boolean;
  useGalleryPalette: boolean;
  isTokyoPalette: boolean;
  isCosmicPalette: boolean;
  isSubnetPalette: boolean;
  isAnalystPalette: boolean;
  isFintechPalette: boolean;
  isInfluencePalette: boolean;
  isTalentPalette: boolean;
  useMassConservingLod: boolean;
  isRankedWork: boolean;
  useLanes: boolean;
  degrees: Uint32Array;
  workData: WorkGraphData;
  groupForNode?: Int32Array;
  nodeKindForNode?: Uint8Array;
  nodeScoreForNode?: Float32Array;
  edgeKindForEdge?: Uint8Array;
  edgeWeightForEdge?: Float32Array;
  edgeConfidenceForEdge?: Float32Array;
  isLargeWork: boolean;
  cx: number;
  cy: number;
  normalizeX: (x: number) => number;
  normalizeY: (y: number) => number;
  analystEqualize: number;
  analystOverview: number;
}
