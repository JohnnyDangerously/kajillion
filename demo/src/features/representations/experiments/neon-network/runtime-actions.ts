import { runBloomAnimation } from '../neon-glass/bloom-animation'
import { buildClusterIndex, refreshClusterCentroids } from './cluster-state'
import { buildTargetAttributes, getStarfield, state } from './cache'
import type { ColorMode } from './color-modes'
import { computeFacetLayout } from './layout-modes'
import type { NeonNetworkRuntime } from './runtime'
import { getRootCenter, snapshotPositions } from './shared'
import { tweenLinkOpacity } from './link-opacity'

export const ATLAS_PADDING = 0.04
export const TARGET_LINK_OPACITY = 0.35
export const MAX_HUB_LABELS = 12

export function playBloom (rt: NeonNetworkRuntime): void {
  rt.cancelBloom?.()
  const { sizes } = buildTargetAttributes(rt.ctx.data.nodeCount)
  const finalPositions = new Float32Array(rt.ctx.data.positions)
  rt.ctx.graph.setPointSizes(new Float32Array(rt.ctx.data.nodeCount))
  rt.ctx.graph.render()
  rt.cancelBloom = runBloomAnimation(rt.ctx.graph, finalPositions, sizes, {
    variant: 'pop',
    durationMs: 1400,
  })
}

export function ringsShouldRun (rt: NeonNetworkRuntime): boolean {
  return rt.viewStack.length === 0 && state.colorMode === 'hue'
}

export function stopRings (rt: NeonNetworkRuntime): void {
  if (rt.ringStartTimer !== 0) {
    clearTimeout(rt.ringStartTimer)
    rt.ringStartTimer = 0
  }
  rt.ringAnimation?.stop()
}

export function scheduleRingsStart (
  rt: NeonNetworkRuntime,
  delayMs: number,
): void {
  if (rt.ringStartTimer !== 0) clearTimeout(rt.ringStartTimer)
  rt.ringStartTimer = window.setTimeout(() => {
    rt.ringStartTimer = 0
    if (!ringsShouldRun(rt)) return
    const net = state.network
    const center = net ? getRootCenter(net) : { x: 4096, y: 4096 }
    rt.ringAnimation?.start(center, net?.nodeCount)
  }, delayMs)
}

export function computeGlobalState (
  rt: NeonNetworkRuntime,
  mode: ColorMode,
): { positions: Float32Array; sizes: Float32Array } {
  const n = state.network
  const sizes = buildTargetAttributes(rt.ctx.data.nodeCount).sizes
  if (!n) return { positions: rt.ctx.data.positions, sizes }
  const bin = computeFacetLayout(mode, n, state.facets ?? undefined, n.positions) ?? n.positions
  // ALWAYS pad up to ctx.data.nodeCount. The engine derives
  // `pointsNumber` from positions.length / 2; if we tween in a
  // 5,157-long array when ctx.data.nodeCount is 19,500, the next
  // colour refresh sees a length mismatch and falls back to
  // pointDefaultColor for *every* node.
  if (rt.ctx.data.nodeCount === n.nodeCount) return { positions: bin, sizes }
  const padded = new Float32Array(rt.ctx.data.nodeCount * 2)
  padded.set(bin, 0)
  // Append starfield positions when present; in light theme starfield
  // is suppressed and the trailing slots stay at (0, 0) — invisible
  // because their sizes are 0.
  const stars = getStarfield(rt.ctx.data.nodeCount)
  if (stars) {
    const starCapacity = rt.ctx.data.nodeCount - n.nodeCount
    const starsToCopy = Math.min(stars.count, starCapacity)
    padded.set(stars.positions.subarray(0, starsToCopy * 2), n.nodeCount * 2)
  }
  return { positions: padded, sizes }
}

export function refreshClusterIndex (
  rt: NeonNetworkRuntime,
  mode: ColorMode,
  targetPositions: Float32Array | null,
): void {
  const net = state.network
  if (!net) return
  rt.currentClusterIndex = buildClusterIndex(mode, net, state.facets ?? undefined)
  if (!rt.currentClusterIndex) {
    rt.tooltipHandle?.hide()
    return
  }
  if (targetPositions) refreshClusterCentroids(rt.currentClusterIndex, targetPositions)
}

export function fadeLinkOpacityTo (
  rt: NeonNetworkRuntime,
  target: number,
  durationMs: number,
  delayMs: number,
): void {
  rt.cancelLinkOpacityTween?.()
  rt.cancelLinkOpacityTween = tweenLinkOpacity(
    rt.ctx.graph,
    target,
    durationMs,
    delayMs,
    TARGET_LINK_OPACITY,
  )
}

export function fitToAtlas (rt: NeonNetworkRuntime, duration: number): void {
  const arr = snapshotPositions(rt.ctx.graph.getPointPositions())
  rt.ctx.graph.setZoomTransformByPointPositions(arr, duration, undefined, ATLAS_PADDING, false)
}

/** Snap all starfield point sizes to 0 immediately, before the layout
 *  tween runs. Used by enter-explode / portrait / personal so the halo
 *  + ambient field don't visibly shrink-out during the 700ms transition
 *  — user prefers a hard cut to a graceful fade for these mode changes.
 *  Stays at 0 through the subsequent tween (targetSizes from
 *  buildFocusSizes / buildPortraitClusterLayout already zero non-bin
 *  indices), and gets restored by tweenHome on exit-to-atlas. */
export function hideStarfield (rt: NeonNetworkRuntime): void {
  const net = state.network
  if (!net) return
  const live = rt.ctx.graph.getPointSizes()
  if (live.length <= net.nodeCount) return
  const next = new Float32Array(live)
  for (let i = net.nodeCount; i < next.length; i += 1) next[i] = 0
  rt.ctx.graph.setPointSizes(next)
}
