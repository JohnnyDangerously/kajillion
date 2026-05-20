import { isWorkMode } from '../work-mode/profile'
import type { WorkGraphData } from '../demo-lifecycle/work-graph-types'
import {
  applyWorkFocusPanel,
  projectWorkFocusPanel,
  type WorkFocusState,
} from '../ui-state/work-focus-panel'
import type { WorkFocusControllerOptions } from './contracts'

export function updateWorkFocusPanel (
  options: WorkFocusControllerOptions,
  workFocusState: WorkFocusState | undefined
): void {
  const cfg = options.getCurrentConfig()
  const isWork = isWorkMode(cfg)
  const currentData = options.getCurrentData()
  const currentRenderData = options.getCurrentRenderData()
  applyWorkFocusPanel(options.focusEl, projectWorkFocusPanel({
    isWork,
    hasGraph: !!options.getCurrentGraph(),
    nodeCount: currentData?.nodeCount ?? cfg.n,
    workData: isWork ? (currentData as WorkGraphData | null) : null,
    renderData: currentRenderData ?? currentData,
    focusState: workFocusState,
  }))
}
