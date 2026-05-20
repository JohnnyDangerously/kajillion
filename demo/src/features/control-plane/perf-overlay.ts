import type { Graph, GpuTimingSnapshot } from '@kajillion/graph'
import type { DemoConfig } from './types'
import type { OverlayElements } from './dom'
import { isWorkMode, resolveWorkModeZoomStage } from '../work-mode'
import {
  estimateGpuFrameMs,
  fmtMs,
  median,
  statMs,
  type GpuStat,
} from './perf-stats'

export { estimateGpuFrameMs, statMs } from './perf-stats'

// Rolling wall-fps probe: count rAF callbacks per 500 ms window. Used by both
// the live overlay and the baseline recorder (the recorder integrates over the
// full measurement window instead of using these samples).
export class WallFps {
  public latest = 0
  public displayHz = 0
  private previousTs = 0
  private readonly frameDeltas: number[] = []
  private isActive = true

  public start (): void {
    const tick = (now: number): void => {
      if (!this.isActive) return
      if (this.previousTs > 0) {
        const dt = now - this.previousTs
        // Ignore page-generation, GC, tab-switch, and debugger stalls. A single
        // long task should not make the visible FPS badge read "2 fps" for a
        // smooth scene after the stall has passed.
        if (dt > 0 && dt < 250) {
          this.frameDeltas.push(dt)
          if (this.frameDeltas.length > 45) this.frameDeltas.shift()
          this.latest = 1000 / median(this.frameDeltas)
          this.displayHz = this.latest
        }
      }
      this.previousTs = now
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  public stop (): void { this.isActive = false }
}

export function effectiveDpr (graphHost: HTMLDivElement): number {
  const canvas = document.querySelector<HTMLCanvasElement>('#graph canvas') ?? graphHost.querySelector('canvas')
  if (!canvas) return window.devicePixelRatio
  const cssWidth = canvas.clientWidth || canvas.getBoundingClientRect().width
  if (cssWidth === 0) return window.devicePixelRatio
  return canvas.width / cssWidth
}

export function paintOverlay (options: {
  overlayEl: OverlayElements;
  graphHost: HTMLDivElement;
  wallFps: WallFps;
  currentConfig: DemoConfig;
  currentGraph: Graph | null;
  renderFps: number | undefined;
  lastRenderSampleCount: number;
  lastRenderSampleTs: number;
  setRenderStats: (stats: { renderFps: number | undefined; lastRenderSampleCount: number; lastRenderSampleTs: number }) => void;
}): void {
  const {
    overlayEl,
    graphHost,
    wallFps,
    currentConfig,
    setRenderStats,
  } = options
  let { renderFps, lastRenderSampleCount, lastRenderSampleTs } = options
  const g = options.currentGraph ?? (window as unknown as { __demoGraph?: Graph }).__demoGraph ?? null
  if (!g) {
    overlayEl.wall.textContent = '—'
    return
  }
  const snap = g.getGpuTimings() as GpuTimingSnapshot | null
  overlayEl.wall.textContent = `${wallFps.latest.toFixed(1)} fps`
  const renderSampleCount =
    ((snap?.['render.canvas'] as GpuStat | undefined)?.sampleCount ?? 0) ||
    Math.max(
      (snap?.['render.lines'] as GpuStat | undefined)?.sampleCount ?? 0,
      (snap?.['render.points'] as GpuStat | undefined)?.sampleCount ?? 0
    )
  const now = performance.now()
  const renderSampleDelta = renderSampleCount - lastRenderSampleCount
  const renderTimeDelta = now - lastRenderSampleTs
  if (renderSampleDelta < 0) {
    lastRenderSampleCount = renderSampleCount
    lastRenderSampleTs = now
    renderFps = undefined
  } else if (renderSampleDelta > 0 && renderTimeDelta >= 500) {
    renderFps = renderSampleDelta * 1000 / renderTimeDelta
    lastRenderSampleCount = renderSampleCount
    lastRenderSampleTs = now
  }
  setRenderStats({ renderFps, lastRenderSampleCount, lastRenderSampleTs })
  const hasRenderFps = renderFps !== undefined && Number.isFinite(renderFps)
  const shouldShowRenderFps = hasRenderFps && (g.isSimulationRunning || renderFps >= 5)
  overlayEl.render.textContent = renderSampleCount > 0
    ? (shouldShowRenderFps ? `${renderFps.toFixed(1)} fps` : g.isSimulationRunning ? 'sampling' : 'settled')
    : '—'
  const gpuFrameMs = estimateGpuFrameMs(snap, g)
  const pacing = g.getFramePacingStats()
  overlayEl.budget.textContent = gpuFrameMs > 0 ? `${(1000 / gpuFrameMs).toFixed(0)} fps` : '—'
  overlayEl.display.textContent = pacing.estimatedRefreshHz > 0 ? `${pacing.estimatedRefreshHz.toFixed(1)} hz` : '—'
  overlayEl.target.textContent = pacing.targetFps > 0 ? `${pacing.targetFps.toFixed(0)} fps` : 'native'
  overlayEl.skip.textContent = `${(pacing.skipRatio * 100).toFixed(1)}%`
  overlayEl.cap.textContent = currentConfig.frameRateLimit > 0
    ? `${currentConfig.frameRateLimit.toFixed(0)} fps`
    : currentConfig.frameRateHeadroomFps > 0
      ? `display -${currentConfig.frameRateHeadroomFps.toFixed(0)}`
      : 'native'
  const zoomDistance = g.getZoomDistance()
  const zoomStage = isWorkMode(currentConfig) ? resolveWorkModeZoomStage(zoomDistance) : null
  overlayEl.zoomDistance.textContent = zoomStage
    ? `${zoomDistance.toFixed(1)} (${zoomStage.id})`
    : `${zoomDistance.toFixed(1)}`
  const policy = g.getResolvedRenderPolicy?.()
  overlayEl.renderPolicy.textContent = policy ? `${policy.state}/${policy.zoomBucket}/${policy.pointMode}` : '—'
  overlayEl.policyDensity.textContent = policy
    ? `${Math.round(policy.densityPointsPerMpx).toLocaleString()} p/mpx`
    : '—'
  overlayEl.policyReason.textContent = policy?.reasons?.join(',') ?? '—'
  overlayEl.quad.textContent = fmtMs(snap?.['force.quadtree.build'] as GpuStat | undefined)
  overlayEl.rep.textContent = fmtMs(snap?.['force.repulsion'] as GpuStat | undefined)
  const linMs = statMs(snap, 'force.link.incoming')
  const loutMs = statMs(snap, 'force.link.outgoing')
  overlayEl.link.textContent = (linMs + loutMs) > 0 ? `${(linMs + loutMs).toFixed(2)} ms` : '—'
  overlayEl.grav.textContent = fmtMs(snap?.['force.gravity'] as GpuStat | undefined)
  overlayEl.canvas.textContent = fmtMs(snap?.['render.canvas'] as GpuStat | undefined)
  const linesCullMs = statMs(snap, 'lines.visible.clear') + statMs(snap, 'lines.visible.cull')
  overlayEl.linesCull.textContent = linesCullMs > 0 ? `${linesCullMs.toFixed(2)} ms` : '—'
  overlayEl.lines.textContent = fmtMs(snap?.['render.lines'] as GpuStat | undefined)
  const pointsCullMs =
    statMs(snap, 'render.points.cull') +
    statMs(snap, 'points.visible.count') +
    statMs(snap, 'points.visible.prefix.groups') +
    statMs(snap, 'points.visible.prefix.blocks') +
    statMs(snap, 'points.visible.prefix.add') +
    statMs(snap, 'points.visible.scatter')
  overlayEl.pointsCull.textContent = pointsCullMs > 0 ? `${pointsCullMs.toFixed(2)} ms` : '—'
  const pointTileBudgetMs = statMs(snap, 'points.visible.tile-budget.clear') + statMs(snap, 'points.visible.tile-budget.select')
  overlayEl.pointsTileBudget.textContent = pointTileBudgetMs > 0 ? `${pointTileBudgetMs.toFixed(2)} ms` : '—'
  overlayEl.points.textContent = fmtMs(snap?.['render.points'] as GpuStat | undefined)
  overlayEl.impostorTilesBin.textContent = fmtMs(snap?.['impostor.tiles.bin'] as GpuStat | undefined)
  overlayEl.impostorTilesResolve.textContent = fmtMs(snap?.['impostor.tiles.resolve'] as GpuStat | undefined)
  overlayEl.impostorAnchorsFill.textContent = fmtMs(snap?.['impostor.anchors.fill'] as GpuStat | undefined)
  overlayEl.impostorAnchorsMaterialize.textContent = fmtMs(snap?.['impostor.anchors.materialize'] as GpuStat | undefined)
  overlayEl.alpha.textContent = `${g.progress.toFixed(3)}${g.isSimulationRunning ? '' : ' (settled)'}`
  overlayEl.dpr.textContent = effectiveDpr(graphHost).toFixed(2)
}
