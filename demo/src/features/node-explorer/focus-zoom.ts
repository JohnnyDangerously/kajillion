import type { Graph } from '@kajillion/graph'

interface FocusZoomOptions {
  graph: Graph;
}

interface FocusZoomHandle {
  /** Smoothly zoom to a "work-level" view — ~25% out from full fit. */
  workZoom: () => void;
  /** Smoothly reset to full fit view. */
  fitView: () => void;
}

const FIT_PADDING = 0.05
const ANIM_MS = 480
// "Work zoom" frames only the inner ~50% of the disc so faces become
// readable while still showing meaningful context. We compute the inner
// subset of positions (those closer to the layout centroid than half the
// max radius) and fit-view to that, which zooms in past the full disc.
const WORK_RADIUS_FRAC = 0.50

/**
 * Camera preset helpers. Wraps Cosmos's
 * `setZoomTransformByPointPositions` with named modes.
 *
 * All operations read the engine's LIVE positions on every call so they
 * always frame whatever layout is currently on screen — never a stale
 * snapshot captured at mount time.
 */
export function createFocusZoom (options: FocusZoomOptions): FocusZoomHandle {
  const { graph } = options

  const livePositions = (): Float32Array => {
    // graph.getPointPositions() returns a plain number[]; copy into a
    // Float32Array because Cosmos's zoom API expects typed input.
    const live = graph.getPointPositions()
    const out = new Float32Array(live.length)
    for (let i = 0; i < live.length; i += 1) out[i] = live[i] as number
    return out
  }

  const fitView = (): void => {
    graph.setZoomTransformByPointPositions(livePositions(), ANIM_MS, undefined, FIT_PADDING, false)
  }
  const workZoom = (): void => {
    const pos = livePositions()
    const [cx, cy] = computeCentroid(pos)
    const maxR = computeMaxRadius(pos, cx, cy)
    const subset = filterByRadius(pos, cx, cy, maxR * WORK_RADIUS_FRAC)
    graph.setZoomTransformByPointPositions(subset, ANIM_MS, undefined, FIT_PADDING, false)
  }
  return { workZoom, fitView }
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

function computeMaxRadius (positions: Float32Array, cx: number, cy: number): number {
  let max = 0
  const n = positions.length / 2
  for (let i = 0; i < n; i += 1) {
    const dx = (positions[i * 2] as number) - cx
    const dy = (positions[i * 2 + 1] as number) - cy
    const r = Math.sqrt(dx * dx + dy * dy)
    if (r > max) max = r
  }
  return max
}

function filterByRadius (positions: Float32Array, cx: number, cy: number, maxR: number): Float32Array {
  const kept: number[] = []
  const n = positions.length / 2
  for (let i = 0; i < n; i += 1) {
    const dx = (positions[i * 2] as number) - cx
    const dy = (positions[i * 2 + 1] as number) - cy
    if (Math.sqrt(dx * dx + dy * dy) <= maxR) {
      kept.push(positions[i * 2] as number, positions[i * 2 + 1] as number)
    }
  }
  // Always include the centroid itself + the bounding circle so even an
  // empty subset still frames correctly.
  if (kept.length === 0) {
    return new Float32Array([cx - maxR, cy - maxR, cx + maxR, cy + maxR])
  }
  return new Float32Array(kept)
}
