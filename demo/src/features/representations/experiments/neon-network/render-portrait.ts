import { state } from './cache'
import { getRootCenter, snapshotPositions } from './shared'
import { buildPortraitClusterLayout } from './portrait-view'
import { tweenPositionsAndSizes } from './layout-tween'
import { runForceRelaxation } from './force-relax'
import { buildFaceLabels, fitFacesAfterDelay } from './name-labels'
import { hideStarfield } from './runtime-actions'
import type { NeonNetworkRuntime } from './runtime'
import type { PortraitLevel } from './view-stack'

export function renderPortraitLevel (
  rt: NeonNetworkRuntime,
  top: PortraitLevel,
): void {
  const net = state.network
  if (!net) return
  rt.hubLabelsHandle?.setVisible(false)
  rt.ctx.graph.setConfigPartial({ maxPointSizeOverride: 320, enableDrag: true })

  const center = getRootCenter(net)
  const livePos = snapshotPositions(rt.ctx.graph.getPointPositions())
  const { positions: targetPos, sizes: targetSizes, faces } = buildPortraitClusterLayout(
    net,
    top.members,
    livePos,
    center,
  )
  hideStarfield(rt)
  rt.cancelLayoutTween?.()
  rt.cancelLayoutTween = tweenPositionsAndSizes(rt.ctx.graph, targetPos, targetSizes, 650, 'burst')
  rt.ctx.graph.setLinks(top.edges)
  rt.ctx.graph.render()

  rt.portraitLabelsHandle?.setLabels(buildFaceLabels(faces))
  fitFacesAfterDelay(
    rt.ctx.graph,
    faces,
    () => rt.viewStack.length > 0 && rt.viewStack[rt.viewStack.length - 1] === top,
    0.18,
    () => rt.portraitLabelsHandle?.setVisible(true),
  )

  const anchored = new Uint8Array(net.nodeCount)
  for (let i = 0; i < net.nodeCount; i += 1) anchored[i] = 1
  for (const m of top.members) anchored[m] = 0
  rt.cancelForceRelax?.()
  rt.currentPortraitAnchored = anchored
  rt.cancelForceRelax = runForceRelaxation(rt.ctx.graph, {
    edges: top.edges,
    anchored,
    durationMs: Infinity,
    strength: 0.012,
    restLength: 320,
    readPositions: () => {
      const live = rt.ctx.graph.getPointPositions()
      if (rt.draggingIdx < 0 || Number.isNaN(rt.dragOverrideX)) return live
      const arr = new Float32Array(live.length)
      for (let i = 0; i < live.length; i += 1) arr[i] = live[i] as number
      arr[rt.draggingIdx * 2] = rt.dragOverrideX
      arr[(rt.draggingIdx * 2) + 1] = rt.dragOverrideY
      return arr
    },
  })
  rt.backButtonHandle?.show(`Back · ${top.value}`)
}
