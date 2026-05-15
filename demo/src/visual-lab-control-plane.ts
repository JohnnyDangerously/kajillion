import {
  EDGE_CODE_TO_KIND,
  type GraphEdgeKind,
  graphFrameFromSnapshot,
  validateViewSpec,
  type GraphFrame,
  type GraphSnapshot,
  type ViewSpec,
} from './graph-contract'

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

interface ControlPlaneAccessors {
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

let analyticsWorker: Worker | null = null
let nextRequestId = 1
let cachedWorkerSnapshotId: string | null = null

export function createVisualLabControlPlane (accessors: ControlPlaneAccessors): VisualLabControlPlane {
  let latestProjectionRequestId = 0
  const listNodeFields = (): string[] => {
    const frame = accessors.getFrame()
    if (!frame) return []
    return Object.entries(frame.node)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => `node.${key}`)
  }
  const listEdgeFields = (): string[] => {
    const frame = accessors.getFrame()
    if (!frame) return []
    return Object.entries(frame.edge)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => `edge.${key}`)
  }
  const getSnapshotSummary = (): GraphSnapshotSummary | null => {
    const snapshot = accessors.getSnapshot()
    if (!snapshot) return null
    return summarizeSnapshot(snapshot, accessors.getFrame())
  }

  return {
    getSnapshotSummary,
    getViewSpec: accessors.getViewSpec,
    validateViewSpec,
    listNodeFields,
    listEdgeFields,
    focusNode: (index, options = {}) => accessors.focusNode?.(index, options) ?? null,
    focusNodeAsync: async (index, options = {}) => {
      const snapshot = accessors.getSnapshot()
      if (!snapshot) return null
      await ensureWorkerSnapshot(snapshot)
      const expansion = await expandNeighborhoodInWorker(snapshot.metadata.snapshotId, index, options)
      return accessors.applyNodeExpansion?.(expansion, options) ?? accessors.focusNode?.(index, options) ?? null
    },
    setNodeFilter: (pointIndices, options = {}) => accessors.setNodeFilter?.(pointIndices, options) ?? null,
    clearInteraction: () => { accessors.clearInteraction?.() },
    getInteractionState: () => accessors.getInteractionState?.() ?? null,
    runSecondDegreeProjection: async (options = {}) => {
      const snapshot = accessors.getSnapshot()
      const view = accessors.getViewSpec()
      if (!snapshot || !view) return null
      const requestId = ++latestProjectionRequestId
      const sourceSnapshotId = snapshot.metadata.snapshotId
      const projected = await runSecondDegreeProjectionInWorker(snapshot, options)
      const currentSnapshot = accessors.getSnapshot()
      if (requestId !== latestProjectionRequestId || currentSnapshot?.metadata.snapshotId !== sourceSnapshotId) {
        return null
      }
      const frame = graphFrameFromSnapshot(projected, view.layout)
      accessors.setSnapshot?.(projected, frame)
      return summarizeSnapshot(projected, frame)
    },
    setVisibleEdgeKinds: (visibleKinds) => {
      const view = accessors.getViewSpec()
      if (!view) return null
      const nextView: ViewSpec = {
        ...view,
        edge: {
          ...view.edge,
          visibleKinds,
        },
      }
      const errors = validateViewSpec(nextView)
      if (errors.length > 0) {
        throw new Error(errors.join('; '))
      }
      accessors.setViewSpec?.(nextView)
      return nextView
    },
    exportSceneRecipe: () => {
      const snapshot = getSnapshotSummary()
      const view = accessors.getViewSpec()
      if (!snapshot || !view) return null
      return { snapshot, view }
    },
  }
}

function ensureWorkerSnapshot (snapshot: GraphSnapshot): Promise<void> {
  if (cachedWorkerSnapshotId === snapshot.metadata.snapshotId) return Promise.resolve()
  analyticsWorker ||= new Worker(new URL('./analytics-worker.ts', import.meta.url), { type: 'module' })
  const worker = analyticsWorker
  const id = nextRequestId++
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent<{ id: number; ok: boolean; error?: string }>): void => {
      if (event.data.id !== id) return
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      if (event.data.ok) {
        cachedWorkerSnapshotId = snapshot.metadata.snapshotId
        resolve()
      } else {
        reject(new Error(event.data.error ?? 'analytics worker failed to cache snapshot'))
      }
    }
    const onError = (event: ErrorEvent): void => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      reject(event.error instanceof Error ? event.error : new Error(event.message))
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    worker.postMessage({ id, type: 'cacheSnapshot', snapshot })
  })
}

function expandNeighborhoodInWorker (
  snapshotId: string,
  rootNode: number,
  options: NodeFocusOptions
): Promise<NeighborhoodExpansion> {
  analyticsWorker ||= new Worker(new URL('./analytics-worker.ts', import.meta.url), { type: 'module' })
  const worker = analyticsWorker
  const id = nextRequestId++
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent<{ id: number; ok: boolean; expansion?: NeighborhoodExpansion; error?: string }>): void => {
      if (event.data.id !== id) return
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      if (event.data.ok && event.data.expansion) {
        resolve(event.data.expansion)
      } else {
        reject(new Error(event.data.error ?? 'analytics worker failed to expand neighborhood'))
      }
    }
    const onError = (event: ErrorEvent): void => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      reject(event.error instanceof Error ? event.error : new Error(event.message))
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    worker.postMessage({
      id,
      type: 'expandNeighborhood',
      snapshotId,
      rootNode,
      options: {
        hops: options.hops,
        maxNodes: options.maxNodes,
      },
    })
  })
}

function runSecondDegreeProjectionInWorker (
  snapshot: GraphSnapshot,
  options: {
    minSharedNeighbors?: number;
    topKPerNode?: number;
    maxNodes?: number;
    maxNewEdges?: number;
  }
): Promise<GraphSnapshot> {
  analyticsWorker ||= new Worker(new URL('./analytics-worker.ts', import.meta.url), { type: 'module' })
  const worker = analyticsWorker
  const id = nextRequestId++
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent<{ id: number; ok: boolean; snapshot?: GraphSnapshot; error?: string }>): void => {
      if (event.data.id !== id) return
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      if (event.data.ok && event.data.snapshot) {
        resolve(event.data.snapshot)
      } else {
        reject(new Error(event.data.error ?? 'analytics worker failed'))
      }
    }
    const onError = (event: ErrorEvent): void => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      reject(event.error instanceof Error ? event.error : new Error(event.message))
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    worker.postMessage({
      id,
      type: 'projectSecondDegree',
      snapshot,
      options,
    })
  })
}

function summarizeSnapshot (snapshot: GraphSnapshot, frame?: GraphFrame | null): GraphSnapshotSummary {
  const edgeKindCounts = new Map<number, number>()
  for (const kind of snapshot.edges.kind) {
    edgeKindCounts.set(kind, (edgeKindCounts.get(kind) ?? 0) + 1)
  }
  const nodeColumns = frame
    ? Object.entries(frame.node).filter(([, value]) => value !== undefined).map(([key]) => `node.${key}`)
    : Object.entries(snapshot.nodes).filter(([, value]) => value !== undefined).map(([key]) => `node.${key}`)
  const edgeColumns = frame
    ? Object.entries(frame.edge).filter(([, value]) => value !== undefined).map(([key]) => `edge.${key}`)
    : Object.entries(snapshot.edges).filter(([, value]) => value !== undefined).map(([key]) => `edge.${key}`)
  return {
    snapshotId: snapshot.metadata.snapshotId,
    datasetId: snapshot.metadata.datasetId,
    graphId: snapshot.metadata.graphId,
    nodeCount: snapshot.metadata.nodeCount,
    edgeCount: snapshot.metadata.edgeCount,
    directed: snapshot.metadata.directed,
    layouts: Object.keys(snapshot.layouts),
    nodeColumns,
    edgeColumns,
    edgeKinds: [...edgeKindCounts.entries()].map(([kind, count]) => ({
      kind: EDGE_CODE_TO_KIND[kind] ?? `unknown:${kind}`,
      count,
    })),
  }
}
