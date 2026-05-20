import {
  applyRuntimeEffectivePixelRatio,
  maybeApplyRuntimeAdaptiveDpr,
  resizeRuntimeCanvas,
  updateRuntimeZoomDragBehaviors,
} from '@/graph/graph/runtime-canvas'
import { renderRuntimeFrame } from '@/graph/graph/runtime-frame-renderer'
import type { GraphRuntimeShellOwner } from './runtime-shell-contracts'

export function installGraphRuntimeRenderMethods (prototype: object): void {
  Object.defineProperties(prototype, {
    update: {
      configurable: true,
      value: function (this: GraphRuntimeShellOwner, simulationAlpha = this.store.alpha): void {
        const { graph } = this
        this.store.pointsTextureSize = Math.ceil(Math.sqrt(graph.pointsNumber ?? 0))
        this.store.linksTextureSize = Math.ceil(Math.sqrt((graph.linksNumber ?? 0) * 2))
        this.create()
        this.initPrograms()
        this.store.alpha = simulationAlpha
      },
      writable: true,
    },
    applyEffectivePixelRatio: {
      configurable: true,
      value: function (this: GraphRuntimeShellOwner, ratio: number): boolean {
        return applyRuntimeEffectivePixelRatio(this.getCanvasContext(), ratio)
      },
      writable: true,
    },
    maybeApplyAdaptiveDpr: {
      configurable: true,
      value: function (this: GraphRuntimeShellOwner, nowMs: number): boolean {
        return maybeApplyRuntimeAdaptiveDpr(this.getCanvasContext(), nowMs)
      },
      writable: true,
    },
    renderFrame: {
      configurable: true,
      value: function (this: GraphRuntimeShellOwner, now?: number): void {
        const state = renderRuntimeFrame(this.getFrameRendererContext(), now)
        this.msaaTarget = state.msaaTarget
        this.isRenderDirty = state.isRenderDirty
        this.renderDirtyFrameCount = state.renderDirtyFrameCount
        this.currentEvent = state.currentEvent
        this.lastPhysicsTickMs = state.lastPhysicsTickMs
      },
      writable: true,
    },
    resizeCanvas: {
      configurable: true,
      value: function (this: GraphRuntimeShellOwner, forceResize = false): void {
        resizeRuntimeCanvas(this.getCanvasContext(), forceResize)
      },
      writable: true,
    },
    updateZoomDragBehaviors: {
      configurable: true,
      value: function (this: GraphRuntimeShellOwner): void {
        updateRuntimeZoomDragBehaviors(this.getCanvasContext())
      },
      writable: true,
    },
  })
}
