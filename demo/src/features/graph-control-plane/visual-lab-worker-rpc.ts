import type { GraphSnapshot } from '../../graph-contract'
import type { NeighborhoodExpansion, NodeFocusOptions } from './visual-lab-control-types'

let analyticsWorker: Worker | null = null
let nextRequestId = 1
let cachedWorkerSnapshotId: string | null = null

function getAnalyticsWorker (): Worker {
  analyticsWorker ||= new Worker(new URL('../../analytics-worker.ts', import.meta.url), { type: 'module' })
  return analyticsWorker
}

export function ensureWorkerSnapshot (snapshot: GraphSnapshot): Promise<void> {
  if (cachedWorkerSnapshotId === snapshot.metadata.snapshotId) return Promise.resolve()
  const worker = getAnalyticsWorker()
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

export function expandNeighborhoodInWorker (
  snapshotId: string,
  rootNode: number,
  options: NodeFocusOptions
): Promise<NeighborhoodExpansion> {
  const worker = getAnalyticsWorker()
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

export function runSecondDegreeProjectionInWorker (
  snapshot: GraphSnapshot,
  options: {
    minSharedNeighbors?: number;
    topKPerNode?: number;
    maxNodes?: number;
    maxNewEdges?: number;
  }
): Promise<GraphSnapshot> {
  const worker = getAnalyticsWorker()
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
