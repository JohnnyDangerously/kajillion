import type { Graph, GraphConfig } from '@kajillion/graph'
import type { CosmicIntroPresentationController } from '../../cosmic-intro/presentation'
import type { GeneratedGraph } from '../../generate-graph'
import type {
  GraphFrame,
  GraphFrameVisibilityFilter,
  GraphSnapshot,
  RenderableGraphData,
  ViewSpec,
} from '../../graph-contract'
import type {
  GraphInteractionSummary,
  NeighborhoodExpansion,
  NodeFilterOptions,
  NodeFocusOptions,
  VisualLabControlPlane,
} from '../../visual-lab-control-plane'
import type { BakeLoadBusyState } from '../bake-layout/bake-load'
import type { ControlElements, FocusElements, OverlayElements } from '../control-plane/dom'
import type { WallFps } from '../control-plane/perf-overlay'
import type { DemoConfig } from '../control-plane/types'
import type { DemoControlController } from '../ui-state/demo-controls'
import type {
  FrameVisualsController,
  VisualAttributeApplyOptions,
} from '../ui-state/frame-visuals'
import type { LabelOverlayController } from '../ui-state/label-overlay/label-overlay'
import type { AnalystZoomVisualRefreshScheduler } from '../ui-state/visual-controls'
import type { VisualAttributes } from '../ui-state/visual-attributes'
import type { WorkFocusController } from '../work-focus'

export interface DemoRuntimeState {
  currentGraph: Graph | null;
  currentData: GeneratedGraph | null;
  currentRenderData: GeneratedGraph | null;
  currentSnapshot: GraphSnapshot | null;
  currentFrame: GraphFrame | null;
  currentViewSpec: ViewSpec | null;
  visualLabControlPlane: VisualLabControlPlane | null;
  labNodeFilterMask: Uint8Array | null;
  labNodeFilterEdgeMode: GraphFrameVisibilityFilter['edgeMode'];
  labInteractionState: GraphInteractionSummary | null;
  currentDataKey: string;
  currentConfig: DemoConfig;
  lastRenderSampleCount: number;
  lastRenderSampleTs: number;
  renderFps: number | undefined;
  exploreNodeClickHook: ((index: number) => void) | null;
  replayCaptureRunner: (() => Promise<unknown>) | null;
}

export interface VisualLabRuntimeActions {
  focusNode: (index: number, options?: NodeFocusOptions) => GraphInteractionSummary | null;
  applyNodeExpansion: (
    expansion: NeighborhoodExpansion,
    options?: NodeFocusOptions
  ) => GraphInteractionSummary | null;
  setNodeFilter: (pointIndices: number[], options?: NodeFilterOptions) => GraphInteractionSummary | null;
  clearInteraction: () => void;
}

export interface DemoRuntimeContext {
  state: DemoRuntimeState;
  overlayEl: OverlayElements;
  ctlEl: ControlElements;
  focusEl: FocusElements;
  graphHost: HTMLDivElement;
  labelOverlay: LabelOverlayController;
  cosmicIntroPresentation: CosmicIntroPresentationController;
  workFocusController: WorkFocusController;
  frameVisualsController: FrameVisualsController;
  analystZoomVisualRefreshScheduler: AnalystZoomVisualRefreshScheduler;
  demoControls: DemoControlController;
  wallFps: WallFps;
  bakeLoadBusyState: BakeLoadBusyState;
  visualLabActions: VisualLabRuntimeActions;
  buildGraphConfig: (cfg: DemoConfig) => GraphConfig;
  applyTheme: (theme: DemoConfig['theme']) => void;
  applyCurrentVisualAttributes: (
    graph: Graph,
    data: GeneratedGraph | RenderableGraphData,
    options?: VisualAttributeApplyOptions
  ) => void;
  buildVisualAttributes: (data: GeneratedGraph | RenderableGraphData) => VisualAttributes;
  applyFrameToCurrentGraph: () => void;
  scheduleAnalystZoomVisualRefresh: (immediate?: boolean) => void;
  rebuildGraph: (cfg: DemoConfig) => Promise<void>;
  exposeDebugGraph: (graph: Graph) => void;
  runReplayCapture: () => Promise<unknown>;
}
