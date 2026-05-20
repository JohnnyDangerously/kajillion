import { initExplore } from '../../explore'
import type { ExploreAdapter } from '../../explore/types'
import { initNodeTreatmentLab } from '../../node-treatment-lab'
import { startAgentCommandLoop } from '../agent-bridge'
import { DEMO_SPACE_SIZE } from '../demo-lifecycle/demo-space'
import type { RuntimeActions } from '../runtime-actions'
import { readControls } from '../control-plane/controls'
import { startDemoOverlayLoop } from './overlay-loop'
import type { DemoRuntimeContext } from './context'

export async function bootDemo (
  runtime: DemoRuntimeContext,
  runtimeActions: RuntimeActions
): Promise<void> {
  const { state } = runtime
  state.currentConfig = readControls(runtime.ctlEl)
  runtime.demoControls.syncNodeButtons()
  await runtime.rebuildGraph(state.currentConfig)
  runtime.wallFps.start()
  startDemoOverlayLoop(runtime)
  runtime.labelOverlay.start()
  startAgentCommandLoop(runtimeActions.applyAgentCommand)
  initNodeTreatmentLab()
  if (new URLSearchParams(window.location.search).get('explore') === '1') {
    const exploreAdapter: ExploreAdapter = {
      spaceSize: DEMO_SPACE_SIZE,
      loadSkeleton: async (p) => {
        await runtimeActions.installAgentGraph(
          { nodeCount: p.nodeCount, positions: p.positions, links: p.spokeLinks },
          { graphId: p.graphId, title: p.title, fit: true, workMode: true, explore: true },
        )
      },
      appendEdges: (links) => { runtimeActions.appendEdgesToCurrentGraph(links) },
      setPositions: (positions) => {
        if (!state.currentGraph || !state.currentRenderData) return
        const next = new Float32Array(positions)
        state.currentRenderData.positions = next
        state.currentGraph.setPointPositions(next, true)
        state.currentGraph.render()
      },
      setColors: (colors) => {
        state.currentGraph?.setPointColors(new Float32Array(colors))
        state.currentGraph?.render()
      },
      registerNodeClick: (cb) => { state.exploreNodeClickHook = cb },
    }
    initExplore(exploreAdapter, 51197947)
  }
}
