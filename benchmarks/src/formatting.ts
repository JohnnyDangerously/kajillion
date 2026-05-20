import { type GpuTimingSnapshot } from '@kajillion/graph'

import { type BenchDiagnostics, type PowerInfo, formatPowerInfo } from './diagnostics'
import { type GeneratedGraph } from './generate-graph'
import { type BenchParams } from './params'

interface PassStats {
  median: number;
  min: number;
  max: number;
  samples: number[];
}

export type AggregateSnapshot = Record<string, PassStats>

export async function postResults (payload: unknown): Promise<void> {
  try {
    const headers = new Headers()
    headers.set('Content-Type', 'application/json')
    // 5 s timeout: if the vite middleware stalls (disk full mid-write, etc.),
    // the bench page would otherwise hang on "Done." forever and headless
    // runners (Playwright/Puppeteer) wait on a never-resolving navigation idle.
    const ctl = new AbortController()
    const timeoutId = setTimeout(() => ctl.abort(), 5000)
    try {
      const res = await fetch('/record-result', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: ctl.signal,
      })
      if (!res.ok) console.warn('record-result failed:', res.status)
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (err) {
    console.warn('record-result error:', err)
  }
}

export function formatMs (ms: number): string {
  if (ms < 0.01) return '< 0.01 ms'
  return `${ms.toFixed(3)} ms`
}

export function median (values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
    : sorted[mid] as number
}

export function aggregate (snapshots: GpuTimingSnapshot[]): AggregateSnapshot {
  const labels = new Set<string>()
  for (const s of snapshots) for (const k of Object.keys(s)) labels.add(k)
  const out: AggregateSnapshot = {}
  for (const label of labels) {
    const samples: number[] = []
    for (const s of snapshots) {
      const t = s[label]
      if (t !== undefined) samples.push(t.avgMs)
    }
    if (samples.length === 0) {
      out[label] = { median: 0, min: 0, max: 0, samples }
      continue
    }
    // Explicit loop instead of Math.min/max(...samples): (a) protects against the
    // spread-arity ceiling on huge arrays, (b) avoids Infinity / -Infinity when
    // samples is somehow empty after a future refactor (Math.min(...[]) = Infinity
    // → JSON.stringify writes null → downstream tooling silently drops the field).
    let lo = samples[0] as number
    let hi = samples[0] as number
    for (let i = 1; i < samples.length; i += 1) {
      const v = samples[i] as number
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
    out[label] = {
      median: median(samples),
      min: lo,
      max: hi,
      samples,
    }
  }
  return out
}

export function deriveFps (rawSnapshots: GpuTimingSnapshot[], measureMs: number): number {
  // Render passes run every render frame; force passes run only when sim is active.
  // FPS = render-pass sample count / measure window in seconds.
  const renderCounts = rawSnapshots.map(s => {
    const candidates = ['render.canvas', 'render.points', 'render.lines'].map(k => s[k]?.sampleCount ?? 0)
    return Math.max(...candidates, 0)
  })
  const medianCount = median(renderCounts)
  return medianCount * 1000 / measureMs
}

export function renderResults (
  agg: AggregateSnapshot,
  container: HTMLElement,
  params: BenchParams,
  data: GeneratedGraph,
  rawSnapshots: GpuTimingSnapshot[],
  wallFpsList: number[],
  diagnostics: BenchDiagnostics[],
  power: PowerInfo
): void {
  const entries = Object.entries(agg).sort((a, b) => b[1].median - a[1].median)
  const totalMedian = entries.reduce((s, [, t]) => s + t.median, 0)
  const fps = deriveFps(rawSnapshots, params.measureMs)
  const msPerFrame = fps > 0 ? 1000 / fps : 0
  const wallFps = median(wallFpsList)
  const wallMsPerFrame = wallFps > 0 ? 1000 / wallFps : 0
  const rows = entries.map(([label, t]) => `
    <tr>
      <td>${label}</td>
      <td style="text-align:right">${formatMs(t.median)}</td>
      <td style="text-align:right">${formatMs(t.min)}</td>
      <td style="text-align:right">${formatMs(t.max)}</td>
      <td style="text-align:right">${t.samples.length}</td>
    </tr>
  `).join('')
  const nodes = data.nodeCount.toLocaleString()
  const edges = data.edgeCount.toLocaleString()
  const dataLabel = new URL(window.location.href).searchParams.get('data') === 'cosmo'
    ? `cosmo-lab community graph, seed=${params.seed}`
    : `Barabási–Albert, m=${params.edgesPerNode}, seed=${params.seed}`
  const datasetLine = `${nodes} nodes &middot; ${edges} edges (${dataLabel})`
  const rawJson = JSON.stringify({
    params,
    dataset: { nodeCount: data.nodeCount, edgeCount: data.edgeCount, generator: dataLabel },
    power,
    derived: { renderFps: fps, msPerRenderFrame: msPerFrame, wallFps, wallMsPerFrame },
    diagnostics,
    aggregate: agg,
    runs: rawSnapshots,
    wallFps: wallFpsList,
  }, null, 2)
  const fallbackRow = '<tr><td colspan="5"><em>No samples — extension unsupported on this browser?</em></td></tr>'
  // Visible warning when the machine is likely throttled (battery + macOS
  // Low Power Mode kicks in silently and drops GPU perf ~1.5-2×). Bigger
  // and yellow so it can't be missed in a quick screenshot review — the
  // bench has produced misleading regression alarms when this state was
  // overlooked.
  const powerBanner = power.throttleSuspected
    ? `<p style="background:#3a2e0a;color:#ffe27a;padding:8px 12px;border-radius:4px;margin:8px 0">
         <strong>⚠︎ Throttle suspected:</strong> ${formatPowerInfo(power)} —
         absolute numbers are NOT comparable to runs on AC power.
       </p>`
    : ''

  container.innerHTML = `
    <h2>Baseline result</h2>
    ${powerBanner}
    <p><strong>Dataset:</strong> ${datasetLine}</p>
    <p><strong>Power:</strong> ${formatPowerInfo(power)}</p>
    <p><strong>Window:</strong> ${params.repeat} run(s) of ${params.measureMs} ms measurement after ${params.warmupMs} ms warmup</p>
    <p><strong>Render FPS (GPU timer, median):</strong> ${fps.toFixed(1)} fps &middot; ${formatMs(msPerFrame)} per render frame</p>
    <p><strong>Wall-clock FPS (rAF count, median):</strong> ${wallFps.toFixed(1)} fps &middot; ${formatMs(wallMsPerFrame)} per frame</p>
    <p><strong>Sum of per-pass medians:</strong> ${formatMs(totalMedian)}
      <em>(reference only — passes don't all run every frame)</em></p>
    <table>
      <thead>
        <tr><th>Pass</th><th>Median (ms)</th><th>Min (ms)</th><th>Max (ms)</th><th>Runs</th></tr>
      </thead>
      <tbody>${rows || fallbackRow}</tbody>
    </table>
    <details>
      <summary>Raw JSON</summary>
      <pre>${rawJson}</pre>
    </details>
  `
}
