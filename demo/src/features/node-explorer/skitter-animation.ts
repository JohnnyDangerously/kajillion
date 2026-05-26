import type { Graph } from '@kajillion/graph'

interface SkitterOptions {
  graph: Graph;
  basePositions: Float32Array;
  /** Indices to pull into a tight cluster. */
  indices: number[];
  /** World-space centre to gather toward. Defaults to centroid of basePositions. */
  destination?: [number, number];
  /** Cluster radius around the destination (world units). */
  clusterRadius?: number;
  durationMs?: number;
}

interface SkitterHandle {
  /** Cancel any running animation. */
  cancel: () => void;
  /** Restore all positions to basePositions. */
  restore: (durationMs?: number) => void;
}

/**
 * Animate a subset of nodes from their layout positions to a tight cluster
 * at `destination`, while every other node stays put. Returns a handle to
 * cancel mid-flight or restore the original layout (animated).
 *
 * Performance: one position array reused, single setPointPositions+render
 * per frame. Linear in nodeCount, but only `indices` actually animate —
 * untouched nodes just get copied through.
 */
export function runSkitter (options: SkitterOptions): SkitterHandle {
  const { graph, basePositions, indices } = options
  const duration = options.durationMs ?? 700
  const clusterR = options.clusterRadius ?? 90
  const n = basePositions.length / 2

  // Default destination = centroid of all positions (close to layout centre).
  const destination = options.destination ?? computeCentroid(basePositions)
  const [cx, cy] = destination

  // Stable per-index angular slot inside the cluster so animations look
  // intentional, not random.
  const targetX = new Float32Array(indices.length)
  const targetY = new Float32Array(indices.length)
  for (let k = 0; k < indices.length; k += 1) {
    const angle = (k / indices.length) * Math.PI * 2
    const r = clusterR * Math.sqrt(k / indices.length)
    targetX[k] = cx + Math.cos(angle) * r
    targetY[k] = cy + Math.sin(angle) * r
  }

  const interp = new Float32Array(basePositions.length)
  interp.set(basePositions)

  let cancelled = false
  let raf = 0
  let mode: 'forward' | 'restore' = 'forward'
  const start = performance.now()

  const step = (): void => {
    if (cancelled) return
    const t = Math.min(1, (performance.now() - start) / duration)
    const e = easeOutCubic(t)
    for (let k = 0; k < indices.length; k += 1) {
      const i = indices[k]
      if (i === undefined || i < 0 || i >= n) continue
      const bx = basePositions[i * 2] as number
      const by = basePositions[i * 2 + 1] as number
      const tx = targetX[k] as number
      const ty = targetY[k] as number
      const fromX = mode === 'forward' ? bx : tx
      const fromY = mode === 'forward' ? by : ty
      const toX = mode === 'forward' ? tx : bx
      const toY = mode === 'forward' ? ty : by
      interp[i * 2] = fromX + (toX - fromX) * e
      interp[i * 2 + 1] = fromY + (toY - fromY) * e
    }
    graph.setPointPositions(interp, true)
    graph.render()
    if (t < 1) {
      raf = requestAnimationFrame(step)
    }
  }
  raf = requestAnimationFrame(step)

  return {
    cancel (): void { cancelled = true; cancelAnimationFrame(raf) },
    restore (restoreMs?: number): void {
      cancelled = true
      cancelAnimationFrame(raf)
      const restoreDuration = restoreMs ?? duration
      const restoreStart = performance.now()
      mode = 'restore'
      cancelled = false
      const restoreStep = (): void => {
        if (cancelled) return
        const t = Math.min(1, (performance.now() - restoreStart) / restoreDuration)
        const e = easeOutCubic(t)
        for (let k = 0; k < indices.length; k += 1) {
          const i = indices[k]
          if (i === undefined || i < 0 || i >= n) continue
          const bx = basePositions[i * 2] as number
          const by = basePositions[i * 2 + 1] as number
          const tx = targetX[k] as number
          const ty = targetY[k] as number
          interp[i * 2] = tx + (bx - tx) * e
          interp[i * 2 + 1] = ty + (by - ty) * e
        }
        graph.setPointPositions(interp, true)
        graph.render()
        if (t < 1) raf = requestAnimationFrame(restoreStep)
      }
      raf = requestAnimationFrame(restoreStep)
    },
  }
}

function computeCentroid (positions: Float32Array): [number, number] {
  const n = positions.length / 2
  if (n === 0) return [0, 0]
  let sx = 0; let sy = 0
  for (let i = 0; i < n; i += 1) {
    sx += positions[i * 2] as number
    sy += positions[i * 2 + 1] as number
  }
  return [sx / n, sy / n]
}

function easeOutCubic (t: number): number {
  const u = 1 - t
  return 1 - u * u * u
}
