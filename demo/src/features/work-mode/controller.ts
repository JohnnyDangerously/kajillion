import { createWorkFocusController } from '../work-focus'
import type {
  WorkFocusController,
  WorkFocusControllerOptions,
} from '../work-focus/contracts'
import { isWorkMode } from './profile'
import {
  resolveWorkModeZoomStage,
  WORK_MODE_ZOOM_STAGE_DURATIONS,
  WORK_MODE_ZOOM_STAGES,
  type WorkModeZoomStage,
  type WorkModeZoomStageId,
} from './zoom-stages'

export interface WorkModeController extends WorkFocusController {
  getZoomStage: () => WorkModeZoomStage | null;
  goToZoomStage: (stage: WorkModeZoomStageId, duration?: number) => void;
  goToGalaxyOverview: () => void;
  goToClusterDiscovery: () => void;
  goToSingleCluster: () => void;
  goToWorkMode: () => void;
}

export type WorkModeControllerOptions = WorkFocusControllerOptions

export function createWorkModeController (options: WorkModeControllerOptions): WorkModeController {
  const focus = createWorkFocusController(options)

  function canControlWorkMode (): boolean {
    return isWorkMode(options.getCurrentConfig()) && !!options.getCurrentGraph()
  }

  function goToZoomStage (stage: WorkModeZoomStageId, duration = WORK_MODE_ZOOM_STAGE_DURATIONS[stage]): void {
    if (!canControlWorkMode()) return
    const graph = options.getCurrentGraph()
    if (!graph) return
    graph.setZoomDistance(WORK_MODE_ZOOM_STAGES[stage].distance, duration, false)
    graph.render()
  }

  return {
    ...focus,
    getZoomStage: () => {
      const graph = options.getCurrentGraph()
      return graph && isWorkMode(options.getCurrentConfig())
        ? resolveWorkModeZoomStage(graph.getZoomDistance())
        : null
    },
    goToZoomStage,
    goToGalaxyOverview: () => goToZoomStage('galaxy'),
    goToClusterDiscovery: () => goToZoomStage('cluster'),
    goToSingleCluster: () => goToZoomStage('single-cluster'),
    goToWorkMode: () => goToZoomStage('work'),
  }
}
