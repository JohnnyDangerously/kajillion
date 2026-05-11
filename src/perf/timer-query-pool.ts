import { Device } from '@luma.gl/core'
import { WebGLDevice } from '@luma.gl/webgl'

const TIME_ELAPSED_EXT = 0x88BF
const GPU_DISJOINT_EXT = 0x8FBB
const QUERY_RESULT_AVAILABLE = 0x8867
const QUERY_RESULT = 0x8866

const ROLLING_WINDOW = 60

interface InFlightQuery {
  label: string;
  query: WebGLQuery;
  frame: number;
}

interface PassStats {
  label: string;
  count: number;
  samples: number[];
  sampleIdx: number;
  filled: number;
}

export interface GpuPassTiming {
  avgMs: number;
  lastMs: number;
  sampleCount: number;
}

export type GpuTimingSnapshot = Record<string, GpuPassTiming>

export class TimerQueryPool {
  private gl: WebGL2RenderingContext | null = null
  private hasTimerQuery = false
  private currentQuery: WebGLQuery | null = null
  private currentLabel: string | null = null
  private inFlight: InFlightQuery[] = []
  private stats = new Map<string, PassStats>()
  private frameCounter = 0
  private skippedReentries = 0
  private disjointEvents = 0

  public constructor (device: Device) {
    if (device.info.type !== 'webgl') return
    const webglDevice = device as WebGLDevice
    const rawGl = webglDevice.gl as WebGL2RenderingContext | null
    if (!rawGl) return
    const ext = rawGl.getExtension('EXT_disjoint_timer_query_webgl2')
    if (!ext) return
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
      this.gl.endQuery(TIME_ELAPSED_EXT)
      this.gl.deleteQuery(this.currentQuery)
      this.skippedReentries += 1
      this.currentQuery = null
      this.currentLabel = null
    }
    const query = this.gl.createQuery()
    if (!query) return
    this.gl.beginQuery(TIME_ELAPSED_EXT, query)
    this.currentQuery = query
    this.currentLabel = label
  }

  public end (): void {
    if (!this.hasTimerQuery || !this.gl || !this.currentQuery || !this.currentLabel) return
    this.gl.endQuery(TIME_ELAPSED_EXT)
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
    const out: GpuTimingSnapshot = {}
    for (const [label, s] of this.stats) {
      const filled = s.filled
      if (filled === 0) continue
      let sum = 0
      for (let i = 0; i < filled; i += 1) sum += s.samples[i] as number
      const avgNs = sum / filled
      const lastIdx = (s.sampleIdx - 1 + ROLLING_WINDOW) % ROLLING_WINDOW
      const lastNs = (s.samples[lastIdx] ?? 0) as number
      out[label] = {
        avgMs: avgNs / 1e6,
        lastMs: lastNs / 1e6,
        sampleCount: s.count,
      }
    }
    return out
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
        this.gl.endQuery(TIME_ELAPSED_EXT)
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
    const disjoint = Boolean(this.gl.getParameter(GPU_DISJOINT_EXT))
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
      const available = Boolean(this.gl.getQueryParameter(q.query, QUERY_RESULT_AVAILABLE))
      if (!available) {
        remaining.push(q)
        continue
      }
      const ns = this.gl.getQueryParameter(q.query, QUERY_RESULT) as number
      this.recordSample(q.label, ns)
      this.gl.deleteQuery(q.query)
    }
    this.inFlight = remaining
  }

  private recordSample (label: string, ns: number): void {
    let s = this.stats.get(label)
    if (!s) {
      s = {
        label,
        count: 0,
        samples: new Array<number>(ROLLING_WINDOW).fill(0),
        sampleIdx: 0,
        filled: 0,
      }
      this.stats.set(label, s)
    }
    s.samples[s.sampleIdx] = ns
    s.sampleIdx = (s.sampleIdx + 1) % ROLLING_WINDOW
    s.count += 1
    if (s.filled < ROLLING_WINDOW) s.filled += 1
  }
}
