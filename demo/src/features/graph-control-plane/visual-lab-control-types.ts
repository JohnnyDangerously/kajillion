import type {
  GraphEdgeKind,
  GraphFrame,
  GraphSnapshot,
  ViewSpec,
} from '../../graph-contract'

export interface GraphSnapshotSummary {
  snapshotId: string;
  datasetId: string;
  graphId: string;
  nodeCount: number;
  edgeCount: number;
  directed: boolean;
  layouts: string[];
  nodeColumns: string[];
  edgeColumns: string[];
  edgeKinds: Array<{ kind: string; count: number }>;
}

export interface NodeFocusOptions {
  hops?: number;
  maxNodes?: number;
  fit?: boolean;
  filter?: boolean | 'visual' | 'materialized';
}

export interface NodeFilterOptions {
  edgeMode?: 'inside' | 'incident';
  fit?: boolean;
  materialize?: boolean;
}

export interface GraphInteractionSummary {
  mode: 'focus' | 'filter';
  rootNode?: number;
  hops?: number;
  nodeCount: number;
  linkCount: number;
  filtered: boolean;
  materialized: boolean;
  samplePointIndices: number[];
  sampleLinkIndices: number[];
}

export interface NeighborhoodExpansion {
  rootNode: number;
  hops: number;
  pointIndices: number[];
  linkIndices: number[];
}

export interface VisualLabControlPlane {
  getSnapshotSummary: () => GraphSnapshotSummary | null;
  getViewSpec: () => ViewSpec | null;
  validateViewSpec: (spec: ViewSpec) => string[];
  listNodeFields: () => string[];
  listEdgeFields: () => string[];
  focusNode: (index: number, options?: NodeFocusOptions) => GraphInteractionSummary | null;
  focusNodeAsync: (index: number, options?: NodeFocusOptions) => Promise<GraphInteractionSummary | null>;
  setNodeFilter: (pointIndices: number[], options?: NodeFilterOptions) => GraphInteractionSummary | null;
  clearInteraction: () => void;
  getInteractionState: () => GraphInteractionSummary | null;
  runSecondDegreeProjection: (options?: {
    minSharedNeighbors?: number;
    topKPerNode?: number;
    maxNodes?: number;
    maxNewEdges?: number;
  }) => Promise<GraphSnapshotSummary | null>;
  setVisibleEdgeKinds: (visibleKinds: GraphEdgeKind[]) => ViewSpec | null;
  exportSceneRecipe: () => { snapshot: GraphSnapshotSummary; view: ViewSpec } | null;
}

export interface ControlPlaneAccessors {
  getSnapshot: () => GraphSnapshot | null;
  getFrame: () => GraphFrame | null;
  getViewSpec: () => ViewSpec | null;
  getInteractionState?: () => GraphInteractionSummary | null;
  setSnapshot?: (snapshot: GraphSnapshot, frame: GraphFrame) => void;
  setViewSpec?: (viewSpec: ViewSpec) => void;
  focusNode?: (index: number, options?: NodeFocusOptions) => GraphInteractionSummary | null;
  applyNodeExpansion?: (expansion: NeighborhoodExpansion, options?: NodeFocusOptions) => GraphInteractionSummary | null;
  setNodeFilter?: (pointIndices: number[], options?: NodeFilterOptions) => GraphInteractionSummary | null;
  clearInteraction?: () => void;
}
