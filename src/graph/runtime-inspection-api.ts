import type { Device } from '@luma.gl/core'

import type { GraphConfigInterface } from '@/graph/config'
import type { Clusters } from '@/graph/modules/Clusters'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Points } from '@/graph/modules/Points'
import type { Store } from '@/graph/modules/Store'
import type { ITimerQueryPool, GpuTimingSnapshot } from '@/graph/perf'
import type { ResolvedRenderPolicy } from '@/graph/render/resolveAdaptiveRenderPolicy'
import { PointPositionReadbackCache } from '@/graph/graph/readback/point-position-readback-cache'
import { readPointPositionsSync } from '@/graph/graph/point-position-views'
import type { RuntimeFrameLoopController } from '@/graph/graph/runtime-frame-loop-controller'
import {
  cloneResolvedRenderPolicy,
  cloneRuntimeDebugFrameTrace,
  getRuntimeGpuTimings,
  resetRuntimeGpuTimings,
} from '@/graph/graph/runtime-public-api'
import type { DebugFrameTraceEvent, FramePacingStats } from '@/graph/graph/runtime-contracts'
import { GraphRuntimeDataApi } from '@/graph/graph/runtime-data-api'

interface GraphRuntimeInspectionOwner {
  _isDestroyed: boolean
  config: GraphConfigInterface
  graph: GraphData
  store: Store
  device: Device | undefined
  points: Points | undefined
  clusters: Clusters | undefined
  timerQueryPool: ITimerQueryPool | undefined
  webGpuPointPositions: PointPositionReadbackCache
  frameLoop: RuntimeFrameLoopController
  debugFrameTrace: DebugFrameTraceEvent[]
  resolvedRenderPolicy: ResolvedRenderPolicy | undefined
  traceDebugFrame: (name: string, data?: Record<string, unknown>) => void
  requestWebGpuPointPositionsSnapshot: (force?: boolean) => void
  onWebGpuPointPositionsCached: (positions: Float32Array) => void
}

export abstract class GraphRuntimeInspectionApi extends GraphRuntimeDataApi {
  private get inspectionOwner (): GraphRuntimeInspectionOwner {
    return this as unknown as GraphRuntimeInspectionOwner
  }

  /**
   * Returns the current simulation progress
   */
  public get progress (): number {
    const owner = this.inspectionOwner
    if (owner._isDestroyed) return 0
    return owner.store.simulationProgress
  }

  /**
   * A value that gives information about the running simulation status.
   */
  public get isSimulationRunning (): boolean {
    const owner = this.inspectionOwner
    if (owner._isDestroyed) return false
    return owner.store.isSimulationRunning
  }

  /**
   * The maximum point size.
   * This value is the maximum size of the `gl.POINTS` primitive that WebGL can render on the user's hardware.
   */
  public get maxPointSize (): number {
    const owner = this.inspectionOwner
    if (owner._isDestroyed) return 0
    return owner.store.maxPointSize
  }

  /**
   * Returns a snapshot of per-pass GPU timings (in milliseconds) for the most recent frames.
   * Requires `enableGpuTimings: true` in config and `EXT_disjoint_timer_query_webgl2` support
   * on the underlying WebGL2 context (widely available in Chromium-based browsers and Safari;
   * disabled by default in Firefox on many systems).
   *
   * Returns `null` if timings are disabled or unsupported.
   *
   * @returns Map of pass label to `{ avgMs, lastMs, sampleCount }`, or `null`.
   */
  public getGpuTimings (): GpuTimingSnapshot | null {
    const owner = this.inspectionOwner
    return getRuntimeGpuTimings(owner._isDestroyed, owner.timerQueryPool)
  }

  /**
   * Returns render-loop pacing diagnostics. Useful for distinguishing display
   * refresh limits from engine/GPU limits on high-refresh monitors.
   */
  public getFramePacingStats (): FramePacingStats {
    return this.inspectionOwner.frameLoop.getFramePacingStats()
  }

  public getDebugFrameTrace (): DebugFrameTraceEvent[] {
    return cloneRuntimeDebugFrameTrace(this.inspectionOwner.debugFrameTrace)
  }

  public getResolvedRenderPolicy (): ResolvedRenderPolicy | undefined {
    return cloneResolvedRenderPolicy(this.inspectionOwner.resolvedRenderPolicy)
  }

  public clearDebugFrameTrace (): void {
    this.inspectionOwner.debugFrameTrace.length = 0
  }

  public markDebugFlash (label = 'manual'): void {
    this.inspectionOwner.traceDebugFrame('flash-marker', { label })
  }

  /**
   * Clears all in-flight GPU timer queries and the rolling sample window.
   * Call this just before starting a measurement period (e.g. after a warmup
   * window has elapsed) so that subsequent `getGpuTimings()` calls reflect
   * only the work done since the reset.
   *
   * No-op when `enableGpuTimings` is false or the extension is unsupported.
   */
  public resetGpuTimings (): void {
    const owner = this.inspectionOwner
    resetRuntimeGpuTimings(owner._isDestroyed, owner.timerQueryPool)
  }

  /**
   * Get current X and Y coordinates of the points.
   * @returns Array of point positions.
   */
  public getPointPositions (): number[] {
    const owner = this.inspectionOwner
    if (owner._isDestroyed || !owner.device || !owner.points) return []
    return readPointPositionsSync({
      device: owner.device,
      graph: owner.graph,
      points: owner.points,
      pointPositionCache: owner.webGpuPointPositions,
      requestWebGpuPointPositionsSnapshot: () => owner.requestWebGpuPointPositionsSnapshot(),
    })
  }

  /**
   * Async readback of settled X/Y point positions from the GPU.
   *
   * On WebGPU this copies the live positionStorageBuffer into a MAP_READ
   * staging buffer and mapAsync's it. The cost is one buffer-to-buffer
   * copy + one GPU submit + one async map (typically 1-5 ms at n=1M on
   * M-series); not per-frame fast, but cheap enough to pre-bake a
   * settled layout or export a snapshot.
   *
   * On WebGL2 this delegates to the synchronous `getPointPositions()`
   * path that already pixel-reads from the FBO.
   *
   * Returns a flat Float32Array of `[x0, y0, x1, y1, ...]` of length
   * `pointsNumber * 2`. Empty array if no points are loaded.
   */
  public async readbackPointPositions (): Promise<Float32Array> {
    const owner = this.inspectionOwner
    if (owner._isDestroyed || !owner.device || !owner.points) return new Float32Array(0)
    if (owner.graph.pointsNumber === undefined) return new Float32Array(0)
    if (owner.device.info?.type === 'webgpu') {
      return owner.webGpuPointPositions.readCurrent({
        readPositions: () => owner.points?.readbackPointPositions() ?? Promise.resolve(new Float32Array(0)),
        isDestroyed: () => owner._isDestroyed,
        onCache: (positions) => owner.onWebGpuPointPositionsCached(positions),
      })
    }
    // WebGL2: the synchronous getPointPositions already reads from the
    // FBO. Wrap it as an async result for API parity.
    const arr = this.getPointPositions()
    return Float32Array.from(arr)
  }

  /**
   * Get current X and Y coordinates of the clusters.
   * @returns Array of cluster positions in `[x0, y0, x1, y1, ...]` order. Do not mutate the returned array.
   */
  public getClusterPositions (): Readonly<number[]> {
    const owner = this.inspectionOwner
    if (owner._isDestroyed || !owner.device || !owner.clusters) return []
    if (owner.graph.pointClusters === undefined || owner.clusters.clusterCount === undefined) return []
    return owner.clusters.getCentroidPositions()
  }
}
