import {
  graphFrameFromSnapshot,
  validateViewSpec,
  type ViewSpec,
} from '../../graph-contract'
import {
  type ControlPlaneAccessors,
  type GraphSnapshotSummary,
  type VisualLabControlPlane,
} from './visual-lab-control-types'
import { summarizeSnapshot } from './visual-lab-snapshot-summary'
import {
  ensureWorkerSnapshot,
  expandNeighborhoodInWorker,
  runSecondDegreeProjectionInWorker,
} from './visual-lab-worker-rpc'

export type {
  ControlPlaneAccessors,
  GraphInteractionSummary,
  GraphSnapshotSummary,
  NeighborhoodExpansion,
  NodeFilterOptions,
  NodeFocusOptions,
  VisualLabControlPlane,
} from './visual-lab-control-types'

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
