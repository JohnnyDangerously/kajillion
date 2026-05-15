import type { GeneratedGraph } from './generate-graph'
import type { GalleryPalette } from './gallery-presets'

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

const EDGE_KIND_TO_CODE: Record<GraphEdgeKind, number> = {
  observed: 0,
  second_degree: 1,
  predicted: 2,
}

export const EDGE_CODE_TO_KIND: GraphEdgeKind[] = ['observed', 'second_degree', 'predicted']

export function buildDefaultViewSpec (params: {
  id?: string;
  name?: string;
  palette: GalleryPalette;
  layout?: GraphLayoutName;
  theme: 'dark' | 'light';
  density: boolean;
  lanes: boolean;
  renderLinks: boolean;
}): ViewSpec {
  return {
    schemaVersion: '0.1',
    id: params.id ?? `view-${params.palette}-${params.theme}`,
    name: params.name ?? `${params.palette} ${params.theme}`,
    layout: params.layout ?? 'force2d',
    node: {
      shape: params.density ? 'dot' : 'bubble',
      colorBy: params.palette === 'category' ? 'category' : 'preset',
      sizeBy: params.density ? 'degree' : 'importance',
    },
    edge: {
      renderer: params.lanes ? 'bundled' : 'straight',
      colorBy: 'sourceTargetMix',
      widthBy: params.lanes ? 'weight' : 'constant',
      visibleKinds: params.renderLinks ? ['observed'] : [],
    },
    labels: {
      mode: params.palette === 'category' ? 'importantOnly' : 'editorialLabels',
      field: 'label',
      maxCount: params.palette === 'category' ? 7 : 32,
    },
    effects: {
      background: params.theme,
      bloom: params.theme === 'dark' ? 0.3 : 0.08,
      saturation: params.theme === 'dark' ? 1.05 : 1.18,
      contrast: params.theme === 'dark' ? 1.0 : 1.08,
    },
    camera: {
      fitPadding: params.density ? 0.22 : 0.18,
      maxZoom: 8,
    },
  }
}

export function generatedGraphToSnapshot (
  graph: GeneratedGraph,
  options: {
    datasetId: string;
    graphId: string;
    title?: string;
    generator: string;
    seed?: number;
    sourceSpaceSize?: number;
    directed?: boolean;
  }
): GraphSnapshot {
  const nodeCount = graph.nodeCount
  const edgeCount = graph.edgeCount
  const ids = new Array<string>(nodeCount)
  const labels = new Array<string>(nodeCount)
  for (let i = 0; i < nodeCount; i += 1) {
    ids[i] = String(i)
    labels[i] = String(i)
  }

  const source = new Uint32Array(edgeCount)
  const target = new Uint32Array(edgeCount)
  const weight = new Float32Array(edgeCount)
  const kind = new Uint8Array(edgeCount)
  const degree = new Uint32Array(nodeCount)
  const indegree = new Uint32Array(nodeCount)
  const outdegree = new Uint32Array(nodeCount)
  const communities = new Uint32Array(nodeCount)
  weight.fill(1)
  kind.fill(EDGE_KIND_TO_CODE.observed)

  for (let i = 0; i < edgeCount; i += 1) {
    const a = Math.max(0, Math.min(nodeCount - 1, Math.trunc(graph.links[i * 2] ?? 0)))
    const b = Math.max(0, Math.min(nodeCount - 1, Math.trunc(graph.links[i * 2 + 1] ?? a)))
    source[i] = a
    target[i] = b
    degree[a] += 1
    degree[b] += 1
    outdegree[a] += 1
    indegree[b] += 1
  }

  for (let i = 0; i < nodeCount; i += 1) {
    communities[i] = degree[i] % 8
  }

  return {
    metadata: {
      schemaVersion: '0.1',
      snapshotId: `${options.datasetId}:${options.graphId}:${nodeCount}:${edgeCount}`,
      datasetId: options.datasetId,
      graphId: options.graphId,
      title: options.title,
      directed: options.directed ?? false,
      nodeCount,
      edgeCount,
      availableLayouts: ['force2d'],
      createdAt: new Date().toISOString(),
      lineage: {
        generator: options.generator,
        seed: options.seed,
        sourceSpaceSize: options.sourceSpaceSize,
      },
    },
    nodes: {
      ids,
      labels,
      degree,
      indegree,
      outdegree,
      community: communities,
    },
    edges: {
      source,
      target,
      weight,
      kind,
    },
    layouts: {
      force2d: graph.positions,
    },
  }
}

export function graphFrameFromSnapshot (snapshot: GraphSnapshot, layout: GraphLayoutName): GraphFrame {
  const positions = snapshot.layouts[layout] ?? snapshot.layouts.force2d
  if (!positions) {
    throw new Error(`GraphSnapshot ${snapshot.metadata.snapshotId} does not include layout "${layout}"`)
  }
  const links = new Float32Array(snapshot.metadata.edgeCount * 2)
  for (let i = 0; i < snapshot.metadata.edgeCount; i += 1) {
    links[i * 2] = snapshot.edges.source[i] ?? 0
    links[i * 2 + 1] = snapshot.edges.target[i] ?? 0
  }
  return {
    snapshotId: snapshot.metadata.snapshotId,
    nodeCount: snapshot.metadata.nodeCount,
    edgeCount: snapshot.metadata.edgeCount,
    positions,
    links,
    node: {
      ids: snapshot.nodes.ids,
      labels: snapshot.nodes.labels,
      degree: snapshot.nodes.degree,
      indegree: snapshot.nodes.indegree,
      outdegree: snapshot.nodes.outdegree,
      community: snapshot.nodes.community,
      futureClosenessScore: snapshot.nodes.futureClosenessScore,
    },
    edge: {
      source: snapshot.edges.source,
      target: snapshot.edges.target,
      weight: snapshot.edges.weight,
      kind: snapshot.edges.kind,
      confidence: snapshot.edges.confidence,
      sharedNeighbors: snapshot.edges.sharedNeighbors,
    },
    dirtyColumns: new Set(['positions', 'links', 'node.degree', 'edge.kind']),
  }
}

export function graphFrameToGeneratedGraph (frame: GraphFrame): GeneratedGraph {
  return {
    positions: frame.positions,
    links: frame.links,
    nodeCount: frame.nodeCount,
    edgeCount: frame.edgeCount,
  }
}

export function graphFrameToVisibleGeneratedGraph (
  frame: GraphFrame,
  visibleKinds: GraphEdgeKind[],
  filter?: GraphFrameVisibilityFilter
): RenderableGraphData {
  if (visibleKinds.length === 0) {
    return {
      positions: frame.positions,
      links: new Float32Array(0),
      nodeCount: frame.nodeCount,
      edgeCount: 0,
      edgeKind: new Uint8Array(0),
      edgeWeight: new Float32Array(0),
    }
  }
  const visibleCodes = new Set<number>()
  for (const kind of visibleKinds) {
    const code = EDGE_KIND_TO_CODE[kind]
    if (code !== undefined) visibleCodes.add(code)
  }
  const pointMask = filter?.pointMask
  const edgeMode = filter?.edgeMode ?? 'inside'
  const hasPointFilter = pointMask !== undefined
  const edgePassesPointFilter = (source: number, target: number): boolean => {
    if (!pointMask) return true
    const sourceVisible = pointMask[source] === 1
    const targetVisible = pointMask[target] === 1
    return edgeMode === 'incident'
      ? sourceVisible || targetVisible
      : sourceVisible && targetVisible
  }
  if (!hasPointFilter && visibleCodes.size === EDGE_CODE_TO_KIND.length) {
    return {
      ...graphFrameToGeneratedGraph(frame),
      edgeKind: frame.edge.kind,
      edgeWeight: frame.edge.weight,
      edgeConfidence: frame.edge.confidence,
      edgeSharedNeighbors: frame.edge.sharedNeighbors,
    }
  }

  let edgeCount = 0
  for (let i = 0; i < frame.edgeCount; i += 1) {
    if (!visibleCodes.has(frame.edge.kind[i] ?? -1)) continue
    if (!edgePassesPointFilter(frame.edge.source[i] ?? -1, frame.edge.target[i] ?? -1)) continue
    edgeCount += 1
  }
  const links = new Float32Array(edgeCount * 2)
  const edgeKind = new Uint8Array(edgeCount)
  const edgeWeight = new Float32Array(edgeCount)
  const edgeConfidence = frame.edge.confidence ? new Float32Array(edgeCount) : undefined
  const edgeSharedNeighbors = frame.edge.sharedNeighbors ? new Uint16Array(edgeCount) : undefined
  let cursor = 0
  for (let i = 0; i < frame.edgeCount; i += 1) {
    if (!visibleCodes.has(frame.edge.kind[i] ?? -1)) continue
    if (!edgePassesPointFilter(frame.edge.source[i] ?? -1, frame.edge.target[i] ?? -1)) continue
    links[cursor * 2] = frame.edge.source[i] ?? 0
    links[cursor * 2 + 1] = frame.edge.target[i] ?? 0
    edgeKind[cursor] = frame.edge.kind[i] ?? 0
    edgeWeight[cursor] = frame.edge.weight[i] ?? 1
    if (edgeConfidence) edgeConfidence[cursor] = frame.edge.confidence?.[i] ?? 0
    if (edgeSharedNeighbors) edgeSharedNeighbors[cursor] = frame.edge.sharedNeighbors?.[i] ?? 0
    cursor += 1
  }
  return {
    positions: frame.positions,
    links,
    nodeCount: frame.nodeCount,
    edgeCount,
    edgeKind,
    edgeWeight,
    edgeConfidence,
    edgeSharedNeighbors,
  }
}

export function validateViewSpec (spec: ViewSpec): string[] {
  const errors: string[] = []
  if (spec.schemaVersion !== '0.1') errors.push(`unsupported schemaVersion: ${spec.schemaVersion}`)
  if (!spec.id) errors.push('id is required')
  if (!spec.name) errors.push('name is required')
  if (!spec.edge.visibleKinds.every(kind => kind in EDGE_KIND_TO_CODE)) errors.push('edge.visibleKinds contains an unknown kind')
  if (spec.labels.maxCount < 0) errors.push('labels.maxCount must be >= 0')
  if (spec.camera.fitPadding < 0 || spec.camera.fitPadding > 0.49) errors.push('camera.fitPadding must be in [0, 0.49]')
  return errors
}
