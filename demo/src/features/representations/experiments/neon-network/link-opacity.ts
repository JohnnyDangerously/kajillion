import type { RepresentationInstallContext } from '../../types'

export function tweenLinkOpacity (
  graph: RepresentationInstallContext['graph'],
  target: number,
  durationMs: number,
  delayMs: number,
  fallbackCurrent: number,
): () => void {
  const from = target > 0 ? 0 : fallbackCurrent
  const start = performance.now() + delayMs
  let cancelled = false
  let rafId = 0

  const step = (now: number): void => {
    if (cancelled) return
    if (now < start) {
      rafId = requestAnimationFrame(step)
      return
    }
    const t = Math.min(1, (now - start) / durationMs)
    const e = 0.5 - (Math.cos(Math.PI * t) * 0.5)
    graph.setConfigPartial({ linkOpacity: from + ((target - from) * e) })
    if (t < 1) rafId = requestAnimationFrame(step)
  }

  rafId = requestAnimationFrame(step)
  return () => {
    cancelled = true
    if (rafId !== 0) cancelAnimationFrame(rafId)
  }
}
