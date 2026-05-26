import { buildTargetAttributes, state } from './cache'
import { buildFocusSizes, getRootCenter, snapshotPositions } from './shared'
import { buildHubSpokes, buildNetworkView } from './network-view'
import { tweenPositionsAndSizes } from './layout-tween'
import type { ExplodeLevel } from './view-stack'
import type { NeonNetworkRuntime } from './runtime'
import { fadeLinkOpacityTo, hideStarfield, MAX_HUB_LABELS, TARGET_LINK_OPACITY } from './runtime-actions'
import type { NeonRenderApi } from './render-api'

export function renderExplodeLevel (
  rt: NeonNetworkRuntime,
  top: ExplodeLevel,
  api: NeonRenderApi,
): void {
  const net = state.network
  if (!net) return
  rt.portraitLabelsHandle?.setVisible(false)
  rt.ctx.graph.setConfigPartial({ maxPointSizeOverride: 120 })

  const bloomedSizes = buildTargetAttributes(rt.ctx.data.nodeCount).sizes
  const center = getRootCenter(net)
  const secondaryValues = top.secondaryFacet === 'hue'
    ? undefined
    : state.facets?.[top.secondaryFacet]
  const livePos = snapshotPositions(rt.ctx.graph.getPointPositions())
  const { positions: targetPos, hubs } = buildNetworkView(
    net,
    top.members,
    secondaryValues,
    livePos,
    center,
  )

  for (const sub of top.subClusters.values()) {
    let sx = 0; let sy = 0
    for (const m of sub.members) {
      sx += targetPos[m * 2] as number
      sy += targetPos[(m * 2) + 1] as number
    }
    sub.centroid = sub.members.length > 0
      ? { x: sx / sub.members.length, y: sy / sub.members.length }
      : null
  }

  const targetSizes = buildFocusSizes(bloomedSizes, top.members)
  hideStarfield(rt)
  rt.cancelLayoutTween?.()
  rt.cancelLayoutTween = tweenPositionsAndSizes(rt.ctx.graph, targetPos, targetSizes, 700, 'burst')
  rt.ctx.graph.setLinks(buildHubSpokes(hubs))
  rt.ctx.graph.render()
  // Bring the spokes in fast (180ms, no delay) so they read as part of
  // the explode animation itself rather than appearing a beat later.
  // The slower 450ms-with-650ms-delay version made the view feel
  // momentarily broken before the lines caught up.
  fadeLinkOpacityTo(rt, TARGET_LINK_OPACITY, 180, 0)

  const labelHubs = hubs
    .slice()
    .sort((a, b) => b.memberIndices.length - a.memberIndices.length)
    .slice(0, MAX_HUB_LABELS)
  rt.hubLabelsHandle?.setHubs(labelHubs)
  window.setTimeout(() => rt.hubLabelsHandle?.setVisible(true), 700)
  rt.backButtonHandle?.show(`Back · ${top.value}`)

  rt.csrAbort?.abort()
  rt.csrAbort = new AbortController()
  api.loadRealEdgesForExplode(top, rt.csrAbort.signal).catch((err: unknown) => {
    if ((err as Error).name !== 'AbortError') console.warn('[neon-network] CSR fetch failed:', err)
  })
}
