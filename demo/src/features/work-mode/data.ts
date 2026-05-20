import type { GeneratedGraph } from '../../generate-graph'
import type {
  GraphFrame,
  GraphFrameVisibilityFilter,
  ViewSpec,
} from '../../graph-contract'
import type { DemoConfig } from '../control-plane/types'
import { DEMO_SPACE_SIZE } from '../demo-lifecycle/demo-space'
import { attachWorkMetadata, renderDataFromFrame } from '../demo-lifecycle/render-data'
import { generateWorkGraph } from '../demo-lifecycle/work-graph-generator'

export function generateWorkModeSourceData (
  cfg: Pick<DemoConfig, 'n' | 'seed'>
): GeneratedGraph {
  return generateWorkGraph(cfg.n, cfg.seed)
}

export function buildWorkModeRenderData (
  frame: GraphFrame,
  viewSpec: ViewSpec,
  cfg: DemoConfig,
  sourceData: GeneratedGraph | null,
  filter?: GraphFrameVisibilityFilter
): GeneratedGraph {
  return attachWorkMetadata(
    renderDataFromFrame(frame, viewSpec, cfg, DEMO_SPACE_SIZE, filter),
    sourceData
  )
}
