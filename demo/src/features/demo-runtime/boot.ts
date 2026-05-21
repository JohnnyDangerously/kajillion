import { initExploreWithOptions } from '../../explore'
import type { ExploreAdapter } from '../../explore/types'
import { initNodeTreatmentLab } from '../../node-treatment-lab'
import { startAgentCommandLoop } from '../agent-bridge'
import { DEMO_SPACE_SIZE } from '../demo-lifecycle/demo-space'
import type { RuntimeActions } from '../runtime-actions'
import { readControls } from '../control-plane/controls'
import {
  applyWorkNetworkNodeMetadata,
  isExplicitWorkDataset,
  WORK_MODE_NETWORK_EXPLORER,
} from '../work-mode'
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
  const params = new URLSearchParams(window.location.search)
  const useWorkExplorer = isExplicitWorkDataset(state.currentConfig)
  if (useWorkExplorer || params.get('explore') === '1') {
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
      setNodeMetadata: (metadata) => {
        applyWorkNetworkNodeMetadata(state.currentData, metadata)
        applyWorkNetworkNodeMetadata(state.currentRenderData, metadata)
        runtime.workFocusController.updatePanel()
      },
      registerNodeClick: (cb) => { state.exploreNodeClickHook = cb },
    }
    initExploreWithOptions(exploreAdapter, WORK_MODE_NETWORK_EXPLORER.seedEntityInt, {
      maxNeighbors: useWorkExplorer ? WORK_MODE_NETWORK_EXPLORER.maxNeighbors : undefined,
      edgeMinScore: useWorkExplorer ? WORK_MODE_NETWORK_EXPLORER.edgeMinScore : undefined,
      autoJumpOnNodeClick: useWorkExplorer
        ? WORK_MODE_NETWORK_EXPLORER.autoJumpOnNodeClick
        : undefined,
    })
  }
}
