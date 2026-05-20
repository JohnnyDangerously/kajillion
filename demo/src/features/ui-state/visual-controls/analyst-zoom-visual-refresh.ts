import { type Graph } from '@kajillion/graph'
import { isWorkMode } from '../../work-mode'
import type { DemoConfig } from '../../control-plane/types'
import type { GeneratedGraph } from '../../../generate-graph'
import type { VisualAttributeApplyOptions } from '../frame-visuals'

interface AnalystZoomVisualRefreshSchedulerOptions {
  getCurrentConfig: () => DemoConfig;
  getCurrentGraph: () => Graph | null;
  getCurrentRenderData: () => GeneratedGraph | null;
  applyCurrentVisualAttributes: (
    graph: Graph,
    data: GeneratedGraph,
    options?: VisualAttributeApplyOptions
  ) => void;
}

export interface AnalystZoomVisualRefreshScheduler {
  reset: () => void;
  schedule: (immediate?: boolean) => void;
}

export function createAnalystZoomVisualRefreshScheduler (
  options: AnalystZoomVisualRefreshSchedulerOptions
): AnalystZoomVisualRefreshScheduler {
  let analystZoomVisualRefreshFrame = 0
  let lastAnalystZoomSizeBucket = -1

  const schedule = (immediate = false): void => {
    const zoomBucket = Math.round((options.getCurrentGraph()?.getZoomDistance?.() ?? 1) / 4)
    if (!immediate && zoomBucket === lastAnalystZoomSizeBucket) return
    const run = (): void => {
      analystZoomVisualRefreshFrame = 0
      const graph = options.getCurrentGraph()
      const data = options.getCurrentRenderData()
      const currentConfig = options.getCurrentConfig()
      if (!graph || !data) return
      if (currentConfig.palette !== 'analyst' || currentConfig.theme !== 'light' || !isWorkMode(currentConfig)) return
      lastAnalystZoomSizeBucket = Math.round(graph.getZoomDistance() / 4)
      options.applyCurrentVisualAttributes(graph, data, { updatePoints: true, updateLinks: false, pointSizesOnly: true })
      graph.render()
    }
    if (immediate) {
      if (analystZoomVisualRefreshFrame) {
        cancelAnimationFrame(analystZoomVisualRefreshFrame)
        analystZoomVisualRefreshFrame = 0
      }
      run()
      return
    }
    if (analystZoomVisualRefreshFrame) return
    analystZoomVisualRefreshFrame = requestAnimationFrame(run)
  }

  const reset = (): void => {
    if (analystZoomVisualRefreshFrame) {
      cancelAnimationFrame(analystZoomVisualRefreshFrame)
      analystZoomVisualRefreshFrame = 0
    }
    lastAnalystZoomSizeBucket = -1
  }

  return { reset, schedule }
}
