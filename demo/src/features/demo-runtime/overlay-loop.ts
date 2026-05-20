import { paintOverlay as paintPerfOverlay } from '../control-plane/perf-overlay'
import type { DemoRuntimeContext } from './context'

export function startDemoOverlayLoop (runtime: DemoRuntimeContext): void {
  const loop = (): void => {
    paintPerfOverlay({
      overlayEl: runtime.overlayEl,
      graphHost: runtime.graphHost,
      wallFps: runtime.wallFps,
      currentConfig: runtime.state.currentConfig,
      currentGraph: runtime.state.currentGraph,
      renderFps: runtime.state.renderFps,
      lastRenderSampleCount: runtime.state.lastRenderSampleCount,
      lastRenderSampleTs: runtime.state.lastRenderSampleTs,
      setRenderStats: (stats) => {
        runtime.state.renderFps = stats.renderFps
        runtime.state.lastRenderSampleCount = stats.lastRenderSampleCount
        runtime.state.lastRenderSampleTs = stats.lastRenderSampleTs
      },
    })
    setTimeout(loop, 250)
  }
  loop()
}
