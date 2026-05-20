import { ROLLING_WINDOW } from './timer-query-pool-webgpu-constants'

import type { GpuTimingSnapshot } from './timer-query-pool'

export interface PassStats {
  label: string;
  count: number;
  samples: number[];
  sampleIdx: number;
  filled: number;
}

export function recordTimingSample (stats: Map<string, PassStats>, label: string, ns: number): void {
  let s = stats.get(label)
  if (!s) {
    s = {
      label,
      count: 0,
      samples: new Array<number>(ROLLING_WINDOW).fill(0),
      sampleIdx: 0,
      filled: 0,
    }
    stats.set(label, s)
  }
  s.samples[s.sampleIdx] = ns
  s.sampleIdx = (s.sampleIdx + 1) % ROLLING_WINDOW
  s.count += 1
  if (s.filled < ROLLING_WINDOW) s.filled += 1
}

export function snapshotTimingStats (stats: Map<string, PassStats>): GpuTimingSnapshot {
  const out: GpuTimingSnapshot = {}
  for (const [label, s] of stats) {
    if (s.filled === 0) continue
    let sum = 0
    for (let i = 0; i < s.filled; i += 1) sum += s.samples[i] as number
    const avgNs = sum / s.filled
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
