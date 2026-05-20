import type { DemoConfig } from '../control-plane/types'
import type { DemoRuntimeState } from './context'

export function createInitialDemoRuntimeState (
  currentConfig: DemoConfig
): DemoRuntimeState {
  return {
    currentGraph: null,
    currentData: null,
    currentRenderData: null,
    currentSnapshot: null,
    currentFrame: null,
    currentViewSpec: null,
    visualLabControlPlane: null,
    labNodeFilterMask: null,
    labNodeFilterEdgeMode: 'inside',
    labInteractionState: null,
    currentDataKey: '',
    currentConfig,
    lastRenderSampleCount: 0,
    lastRenderSampleTs: performance.now(),
    renderFps: undefined,
    exploreNodeClickHook: null,
    replayCaptureRunner: null,
  }
}
