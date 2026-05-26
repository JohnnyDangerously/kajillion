import { state } from './cache'
import { getRootCenter, snapshotPositions } from './shared'
import { buildPersonalNetworkLayout } from './personal-network'
import { tweenPositionsAndSizes } from './layout-tween'
import { buildFaceLabels, fitFacesAfterDelay } from './name-labels'
import { hideStarfield } from './runtime-actions'
import type { NeonNetworkRuntime } from './runtime'
import type { PersonalLevel } from './view-stack'

export function renderPersonalLevel (
  rt: NeonNetworkRuntime,
  top: PersonalLevel,
): void {
  const net = state.network
  if (!net) return
  rt.portraitLabelsHandle?.setVisible(false)
  rt.hubLabelsHandle?.setVisible(false)
  rt.ctx.graph.setConfigPartial({
    maxPointSizeOverride: 360,
    enableDrag: true,
    enableSimulation: true,
    simulationGravity: 0.18,
    simulationRepulsion: 0.5,
    simulationLinkSpring: 0.9,
    simulationLinkDistance: 320,
    simulationFriction: 0.85,
    simulationDecay: 800,
  })

  const center = getRootCenter(net)
  const livePos = snapshotPositions(rt.ctx.graph.getPointPositions())
  const { positions: targetPos, sizes: targetSizes, faces } = buildPersonalNetworkLayout(
    net,
    top.pnet,
    livePos,
    center,
  )
  hideStarfield(rt)
  rt.cancelLayoutTween?.()
  rt.cancelLayoutTween = tweenPositionsAndSizes(rt.ctx.graph, targetPos, targetSizes, 600, 'burst')
  rt.ctx.graph.setLinks(top.pnet.edges)
  setPersonalLinkWidths(rt, top.pnet.edgeWeights)
  rt.ctx.graph.render()
  // Label cap: focal + the 20 highest-scoring neighbours. Without this
  // a broad personal network (Thomas Hansbury → ~100 contacts) buries
  // the disc under name chips that overlap each other and the dots,
  // turning the view into visual noise. The dropped names are still
  // discoverable on hover via the explorer.
  const MAX_PERSONAL_LABELS = 20
  const labelFaces = (() => {
    const focal = faces.filter(f => f.isFocal)
    const rest = faces
      .filter(f => !f.isFocal)
      .sort((a, b) => (net.scores[b.idx] ?? 0) - (net.scores[a.idx] ?? 0))
      .slice(0, MAX_PERSONAL_LABELS)
    return [...focal, ...rest]
  })()
  rt.portraitLabelsHandle?.setLabels(buildFaceLabels(labelFaces))
  fitFacesAfterDelay(
    rt.ctx.graph,
    faces,
    () => rt.viewStack.length > 0 && rt.viewStack[rt.viewStack.length - 1] === top,
    0.15,
    () => rt.portraitLabelsHandle?.setVisible(true),
  )
  rt.backButtonHandle?.show(`Back · ${top.focalName}`)
}

function setPersonalLinkWidths (
  rt: NeonNetworkRuntime,
  edgeWeights: Float32Array,
): void {
  if (edgeWeights.length === 0) return
  let maxW = 1
  for (let i = 0; i < edgeWeights.length; i += 1) {
    const w = edgeWeights[i] as number
    if (w > maxW) maxW = w
  }
  const widths = new Float32Array(edgeWeights.length)
  for (let i = 0; i < edgeWeights.length; i += 1) {
    widths[i] = 0.6 + (((edgeWeights[i] as number) / maxW) * 2.4)
  }
  rt.ctx.graph.setLinkWidths(widths)
}
