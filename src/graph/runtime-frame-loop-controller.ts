import type { GraphConfigInterface } from '@/graph/config'
import type { Store } from '@/graph/modules/Store'

import {
  getTargetRenderFps,
  shouldRenderOnRaf,
  updateRefreshEstimate,
} from './frame-pacing'
import { type FramePacingStats } from './runtime-contracts'
import { getRuntimeFramePacingStats } from './runtime-public-api'
import { resolveAlphaStopThreshold } from './runtime-render-loop'

export interface RuntimeFrameLoopControllerContext {
  isDestroyed: () => boolean
  config: GraphConfigInterface
  store: Store
  renderFrame: (now: number) => void
  endSimulation: () => void
  traceDebugFrame: (name: string, data?: Record<string, unknown>) => void
}

export interface RuntimeFrameLoopCounters {
  rafCallbackCount: number
  renderedFrameCount: number
  skippedFrameCount: number
}

export class RuntimeFrameLoopController {
  private requestAnimationFrameId = 0
  private lastRafFrameMs = 0
  private estimatedRefreshHz = 60
  private nextRenderEligibleMs = 0
  private rafCallbackCount = 0
  private renderedFrameCount = 0
  private skippedFrameCount = 0

  public constructor (private readonly context: RuntimeFrameLoopControllerContext) {}

  public getFramePacingStats (): FramePacingStats {
    return getRuntimeFramePacingStats({
      estimatedRefreshHz: this.estimatedRefreshHz,
      rafCallbackCount: this.rafCallbackCount,
      renderedFrameCount: this.renderedFrameCount,
      skippedFrameCount: this.skippedFrameCount,
      targetFps: this.getTargetRenderFps(),
    })
  }

  public getCounters (): RuntimeFrameLoopCounters {
    return {
      rafCallbackCount: this.rafCallbackCount,
      renderedFrameCount: this.renderedFrameCount,
      skippedFrameCount: this.skippedFrameCount,
    }
  }

  public stop (): void {
    if (this.requestAnimationFrameId) {
      window.cancelAnimationFrame(this.requestAnimationFrameId)
      this.requestAnimationFrameId = 0
    }
  }

  public start (): void {
    if (this.context.isDestroyed()) return
    this.stop()
    this.frame()
  }

  private frame (): void {
    if (this.context.isDestroyed()) return

    const { store } = this.context
    const stopThreshold = resolveAlphaStopThreshold(this.context.config.alphaStopThreshold)
    if (store.alpha < stopThreshold && store.isSimulationRunning) {
      this.context.endSimulation()
    }

    this.requestAnimationFrameId = window.requestAnimationFrame((now) => {
      this.rafCallbackCount += 1
      this.updateRefreshEstimate(now)
      if (this.shouldRenderOnThisRaf(now)) {
        this.renderedFrameCount += 1
        this.context.renderFrame(now)
      } else {
        this.skippedFrameCount += 1
        this.context.traceDebugFrame('pacing-skip', {
          targetFps: this.getTargetRenderFps(),
          nextRenderEligibleMs: this.nextRenderEligibleMs,
        })
      }

      if (!this.context.isDestroyed()) {
        this.frame()
      }
    })
  }

  private updateRefreshEstimate (now: number): void {
    const state = updateRefreshEstimate({
      lastRafFrameMs: this.lastRafFrameMs,
      estimatedRefreshHz: this.estimatedRefreshHz,
      nextRenderEligibleMs: this.nextRenderEligibleMs,
    }, now, typeof document === 'undefined' || document.visibilityState === 'visible')
    this.lastRafFrameMs = state.lastRafFrameMs
    this.estimatedRefreshHz = state.estimatedRefreshHz
    this.nextRenderEligibleMs = state.nextRenderEligibleMs
  }

  private getTargetRenderFps (): number {
    return getTargetRenderFps(
      this.context.config.frameRateLimit,
      this.context.config.frameRateHeadroomFps,
      this.estimatedRefreshHz,
    )
  }

  private shouldRenderOnThisRaf (now: number): boolean {
    const targetFps = this.getTargetRenderFps()
    const decision = shouldRenderOnRaf(now, targetFps, this.nextRenderEligibleMs)
    this.nextRenderEligibleMs = decision.nextRenderEligibleMs
    return decision.shouldRender
  }
}
