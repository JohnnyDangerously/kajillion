import { Device } from '@luma.gl/core'
import { WebGLDevice } from '@luma.gl/webgl'

import { createTimingStats, recordTimingSample, snapshotTimingStats } from './timer-query-pool-stats'
import { getTimerQueryEnums } from './timer-query-pool-webgl-extension'

import type { GpuTimingSnapshot } from './timer-query-pool-stats'

export type { GpuPassTiming, GpuTimingSnapshot } from './timer-query-pool-stats'

interface InFlightQuery {
  label: string;
  query: WebGLQuery;
  frame: number;
}

export class TimerQueryPool {
  private gl: WebGL2RenderingContext | null = null
  private hasTimerQuery = false
  private timeElapsedEnum = 0
  private gpuDisjointEnum = 0
  private queryResultAvailableEnum = 0
  private queryResultEnum = 0
  private currentQuery: WebGLQuery | null = null
  private currentLabel: string | null = null
  private inFlight: InFlightQuery[] = []
  private stats = createTimingStats()
  private frameCounter = 0
  private skippedReentries = 0
  private disjointEvents = 0

  public constructor (device: Device) {
    if (device.info.type !== 'webgl') {
      console.warn('[kajillion] GPU timing requires a WebGL2 device; got', device.info.type)
      return
    }
    const webglDevice = device as WebGLDevice
    const rawGl = webglDevice.gl as WebGL2RenderingContext | null
    if (!rawGl) return
    const enums = getTimerQueryEnums(rawGl)
    if (!enums) {
      console.warn(
        '[kajillion] EXT_disjoint_timer_query_webgl2 unavailable in this browser; ' +
        'GPU timings disabled. Firefox: enable webgl.enable-privileged-extensions in about:config.'
      )
      return
    }
    this.timeElapsedEnum = enums.timeElapsed
    this.gpuDisjointEnum = enums.gpuDisjoint
    this.queryResultAvailableEnum = enums.queryResultAvailable
    this.queryResultEnum = enums.queryResult
    this.gl = rawGl
    this.hasTimerQuery = true
  }

  public isSupported (): boolean {
    return this.hasTimerQuery
  }

  public tick (): void {
    if (!this.hasTimerQuery || !this.gl) return
    this.frameCounter += 1
    this.drainReady()
  }

  public begin (label: string): void {
    if (!this.hasTimerQuery || !this.gl) return
    if (this.currentQuery) {
      // Re-entry: a prior begin() didn't get its matching end() (early-return,
      // throw outside wrap(), branch bug). Close + drop the stale query so the
      // new label's data isn't silently attributed to the previous label.
      this.gl.endQuery(this.timeElapsedEnum)
      this.gl.deleteQuery(this.currentQuery)
      this.skippedReentries += 1
      this.currentQuery = null
      this.currentLabel = null
    }
    const query = this.gl.createQuery()
    if (!query) return
    this.gl.beginQuery(this.timeElapsedEnum, query)
    this.currentQuery = query
    this.currentLabel = label
  }

  public end (): void {
    if (!this.hasTimerQuery || !this.gl || !this.currentQuery || !this.currentLabel) return
    this.gl.endQuery(this.timeElapsedEnum)
    this.inFlight.push({
      label: this.currentLabel,
      query: this.currentQuery,
      frame: this.frameCounter,
    })
    this.currentQuery = null
    this.currentLabel = null
  }

  public wrap (label: string, fn: () => void): void {
    this.begin(label)
    try {
      fn()
    } finally {
      this.end()
    }
  }

  public getSnapshot (): GpuTimingSnapshot {
    return snapshotTimingStats(this.stats)
  }

  public reset (): void {
    if (this.gl) {
      for (const q of this.inFlight) this.gl.deleteQuery(q.query)
    }
    this.inFlight = []
    this.stats.clear()
  }

  public destroy (): void {
    // Guard against context-lost state and silently swallow any spec-edge errors
    // — destroy() is a cleanup path; throwing here would break Graph.destroy().
    if (this.gl && this.currentQuery && !this.gl.isContextLost()) {
      try {
        this.gl.endQuery(this.timeElapsedEnum)
        this.gl.deleteQuery(this.currentQuery)
      } catch {
        // ignore — context may have transitioned mid-tick
      }
    }
    this.reset()
    this.currentQuery = null
    this.currentLabel = null
    this.gl = null
    this.hasTimerQuery = false
  }

  private drainReady (): void {
    if (!this.gl || this.inFlight.length === 0) return
    const disjoint = Boolean(this.gl.getParameter(this.gpuDisjointEnum))
    if (disjoint) {
      // Spec: when GPU_DISJOINT_EXT is true, ALL outstanding queries on the
      // context are invalid — not just the ready ones. Drop the entire queue
      // so future drains don't record contaminated samples from queries that
      // happened to still be pending across the disjoint event.
      for (const q of this.inFlight) this.gl.deleteQuery(q.query)
      this.inFlight = []
      this.disjointEvents += 1
      return
    }
    const remaining: InFlightQuery[] = []
    for (const q of this.inFlight) {
      const available = Boolean(this.gl.getQueryParameter(q.query, this.queryResultAvailableEnum))
      if (!available) {
        remaining.push(q)
        continue
      }
      const ns = this.gl.getQueryParameter(q.query, this.queryResultEnum) as number
      recordTimingSample(this.stats, q.label, ns)
      this.gl.deleteQuery(q.query)
    }
    this.inFlight = remaining
  }
}
