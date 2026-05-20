import { type GraphConfigInterface } from '@/graph/config'
import { type ResolvedRenderPolicy } from '@/graph/render/resolveAdaptiveRenderPolicy'
import {
  getBestKnownRuntimeWebGpuPointPositions,
  markRuntimeLinksChanged,
  markRuntimePointPositionsChanged,
  onRuntimeWebGpuPointPositionsCached,
  rebuildRuntimeWebGpuLinkPickerGrid,
  rebuildRuntimeWebGpuPointPickerGrid,
  requestRuntimeWebGpuPointPositionsSnapshot,
} from '@/graph/graph/runtime-position-cache'
import { endRuntimeSimulation } from '@/graph/graph/runtime-simulation-controls'
import {
  applyGraphConfigUpdate,
  initGraphRuntimePrograms,
  resolveGraphRenderPolicy,
  runGraphHoverDetection,
  runGraphRuntimeSimulationStep,
  traceGraphDebugFrame,
  type GraphStateAdapterOwner,
} from '@/graph/graph/runtime-state-adapters'
import type { GraphRuntimeShellOwner } from './runtime-shell-contracts'
import { installGraphRuntimeRenderMethods } from './runtime-shell-render-methods'

export function installGraphRuntimeMethods (target: { prototype: GraphRuntimeShellOwner }): void {
  installGraphRuntimeRenderMethods(target.prototype)
  Object.defineProperties(target.prototype, {
    applyConfigUpdate: {
      configurable: true,
      value: function (this: GraphRuntimeShellOwner, prevConfig: GraphConfigInterface): void {
        applyGraphConfigUpdate(this as unknown as GraphStateAdapterOwner, prevConfig)
      },
      writable: true,
    },
    ensureDevice: {
      configurable: true,
      value: function (this: GraphRuntimeShellOwner, callback: () => void): boolean {
        if (!this.isReady) {
          this.ready
            .then(() => {
              if (this._isDestroyed) return
              callback()
            })
            .catch(error => {
              console.error('Device initialization failed', error)
            })
          return true
        }
        return false
      },
      writable: true,
    },
    traceDebugFrame: {
      configurable: true,
      value: function (this: GraphRuntimeShellOwner, name: string, data?: Record<string, unknown>): void {
        traceGraphDebugFrame(this as unknown as GraphStateAdapterOwner, name, data)
      },
      writable: true,
    },
    markPointPositionsChanged: {
      configurable: true,
      value: function (this: GraphRuntimeShellOwner, invalidateKnownPickerData = false): void {
        markRuntimePointPositionsChanged(this.getPositionCacheContext(), invalidateKnownPickerData)
      },
      writable: true,
    },
    markLinksChanged: {
      configurable: true,
      value: function (this: GraphRuntimeShellOwner): void {
        markRuntimeLinksChanged(this.getPositionCacheContext())
      },
      writable: true,
    },
    markRenderDirty: {
      configurable: true,
      value: function (this: GraphRuntimeShellOwner, frames = 3): void {
        this.isRenderDirty = true
        this.renderDirtyFrameCount = Math.max(this.renderDirtyFrameCount, frames)
      },
      writable: true,
    },
    resolveRenderPolicy: {
      configurable: true,
      value: function (this: GraphRuntimeShellOwner): ResolvedRenderPolicy {
        return resolveGraphRenderPolicy(this as unknown as GraphStateAdapterOwner)
      },
      writable: true,
    },
    onWebGpuPointPositionsCached: {
      configurable: true,
      value: function (this: GraphRuntimeShellOwner, positions: Float32Array): void {
        onRuntimeWebGpuPointPositionsCached(this.getPositionCacheContext(), positions)
      },
      writable: true,
    },
    requestWebGpuPointPositionsSnapshot: {
      configurable: true,
      value: function (this: GraphRuntimeShellOwner, force = false): void {
        requestRuntimeWebGpuPointPositionsSnapshot(this.getPositionCacheContext(), force)
      },
      writable: true,
    },
    rebuildWebGpuPointPickerGrid: {
      configurable: true,
      value: function (this: GraphRuntimeShellOwner, positions: Float32Array): void {
        rebuildRuntimeWebGpuPointPickerGrid(this.getPositionCacheContext(), positions)
      },
      writable: true,
    },
    rebuildWebGpuLinkPickerGrid: {
      configurable: true,
      value: function (this: GraphRuntimeShellOwner, positions: Float32Array): void {
        rebuildRuntimeWebGpuLinkPickerGrid(this.getPositionCacheContext(), positions)
      },
      writable: true,
    },
    getBestKnownWebGpuPointPositions: {
      configurable: true,
      value: function (this: GraphRuntimeShellOwner): Float32Array | undefined {
        return getBestKnownRuntimeWebGpuPointPositions(this.getPositionCacheContext())
      },
      writable: true,
    },
    runSimulationStep: {
      configurable: true,
      value: function (this: GraphRuntimeShellOwner, forceExecution = false): void {
        runGraphRuntimeSimulationStep(this as unknown as GraphStateAdapterOwner, forceExecution)
      },
      writable: true,
    },
    initPrograms: {
      configurable: true,
      value: function (this: GraphRuntimeShellOwner): void {
        initGraphRuntimePrograms(this as unknown as GraphStateAdapterOwner)
      },
      writable: true,
    },
    end: {
      configurable: true,
      value: function (this: GraphRuntimeShellOwner): void {
        endRuntimeSimulation(this.getSimulationControlContext())
      },
      writable: true,
    },
    findHoveredItem: {
      configurable: true,
      value: function (this: GraphRuntimeShellOwner): void {
        runGraphHoverDetection(this as unknown as GraphStateAdapterOwner)
      },
      writable: true,
    },
  })
}
