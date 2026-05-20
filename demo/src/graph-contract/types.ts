import type { GeneratedGraph } from '../generate-graph'

export type GraphEdgeKind = 'observed' | 'second_degree' | 'predicted'
export type GraphLayoutName = 'force2d' | 'radial2d' | 'globe3d' | 'cluster2d'
export type NodeShape = 'dot' | 'bubble' | 'ring' | 'triangle' | 'square'
export type EdgeRendererKind = 'straight' | 'weighted' | 'curved' | 'hair' | 'bundled' | 'squiggle' | 'globeArc'
export type LabelMode = 'none' | 'importantOnly' | 'accountLabels' | 'editorialLabels'

export interface GraphSnapshotMetadata {
  schemaVersion: '0.1';
  snapshotId: string;
  datasetId: string;
  graphId: string;
  title?: string;
  directed: boolean;
  nodeCount: number;
  edgeCount: number;
  availableLayouts: GraphLayoutName[];
  createdAt: string;
  lineage?: {
    generator: string;
    seed?: number;
    sourceSpaceSize?: number;
  };
}

export interface GraphNodeTable {
  ids: string[];
  labels: string[];
  degree: Uint32Array;
  indegree: Uint32Array;
  outdegree: Uint32Array;
  pagerank?: Float32Array;
  betweenness?: Float32Array;
  closeness?: Float32Array;
  community?: Uint32Array;
  futureClosenessScore?: Float32Array;
}

export interface GraphEdgeTable {
  source: Uint32Array;
  target: Uint32Array;
  weight: Float32Array;
  kind: Uint8Array;
  confidence?: Float32Array;
  sharedNeighbors?: Uint16Array;
}

export interface GraphSnapshot {
  metadata: GraphSnapshotMetadata;
  nodes: GraphNodeTable;
  edges: GraphEdgeTable;
  layouts: Partial<Record<GraphLayoutName, Float32Array>>;
}

export interface GraphFrame {
  snapshotId: string;
  nodeCount: number;
  edgeCount: number;
  positions: Float32Array;
  links: Float32Array;
  node: {
    ids: string[];
    labels: string[];
    degree: Uint32Array;
    indegree: Uint32Array;
    outdegree: Uint32Array;
    community?: Uint32Array;
    futureClosenessScore?: Float32Array;
  };
  edge: {
    source: Uint32Array;
    target: Uint32Array;
    weight: Float32Array;
    kind: Uint8Array;
    confidence?: Float32Array;
    sharedNeighbors?: Uint16Array;
  };
  dirtyColumns: Set<string>;
}

export interface RenderableGraphData extends GeneratedGraph {
  edgeKind?: Uint8Array;
  edgeWeight?: Float32Array;
  edgeConfidence?: Float32Array;
  edgeSharedNeighbors?: Uint16Array;
}

export interface GraphFrameVisibilityFilter {
  pointMask?: Uint8Array;
  edgeMode?: 'inside' | 'incident';
}

export interface ViewSpec {
  schemaVersion: '0.1';
  id: string;
  name: string;
  layout: GraphLayoutName;
  node: {
    shape: NodeShape;
    colorBy: string;
    sizeBy: string;
    opacityBy?: string;
  };
  edge: {
    renderer: EdgeRendererKind;
    colorBy: string;
    widthBy: string;
    opacityBy?: string;
    visibleKinds: GraphEdgeKind[];
  };
  labels: {
    mode: LabelMode;
    field: string;
    maxCount: number;
  };
  effects: {
    background: 'dark' | 'light' | 'dashboard' | 'transparent';
    bloom: number;
    saturation: number;
    contrast: number;
  };
  camera: {
    fitPadding: number;
    maxZoom: number;
  };
}
