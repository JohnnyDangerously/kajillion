import { buildEdgesFromBatch, fetchNeighborsBatch } from './csr-client'
import { buildExplodeLevel } from './explode-level'
import { fetchPersonalNetwork } from './personal-network'
import { pickPortraitMembers, PORTRAIT_MAX_MEMBERS } from './portrait-view'
import type { HubPlacement } from './network-view'
import type { NeonNetworkRuntime } from './runtime'
import { computeGlobalState, fadeLinkOpacityTo, scheduleRingsStart } from './runtime-actions'
import { state } from './cache'
import { tweenPositionsAndSizes } from './layout-tween'

export interface NavigationApi {
  renderTopOfStack: () => void;
}

export function enterExplode (
  rt: NeonNetworkRuntime,
  nodeIndex: number,
  api: NavigationApi,
): void {
  if (rt.viewStack.length > 0) return
  const idx = rt.currentClusterIndex
  if (!idx) return
  const key = idx.byNode[nodeIndex]
  if (!key) return
  const info = idx.byKey.get(key)
  if (!info) return
  rt.viewStack.push(buildExplodeLevel(key, info.value, info.members, state.colorMode, state.facets))
  api.renderTopOfStack()
}

export async function enterPortraitFromHub (
  rt: NeonNetworkRuntime,
  hub: HubPlacement,
  api: NavigationApi,
): Promise<void> {
  const net = state.network
  if (!net) return
  hideProfilePanel()
  // Snap the previous view out immediately so the user gets feedback
  // at the moment they click, not seconds later when the CSR fetch
  // returns. Without this the entire markets/industries cluster
  // layout sits on top of the (eventually-rendered) portrait, which
  // reads as two views fighting for the canvas.
  snapClearForFocus(rt, hub.hubIdx)
  rt.csrAbort?.abort()
  rt.csrAbort = new AbortController()
  const members = pickPortraitMembers(net, [hub.hubIdx, ...hub.memberIndices], PORTRAIT_MAX_MEMBERS)
  const memberEids = members.map(i => net.eids[i] as number)
  const batch = await fetchNeighborsBatch(memberEids, 60, rt.csrAbort.signal)
  if (rt.csrAbort.signal.aborted) return
  let edges = new Float32Array(0)
  if (batch) edges = buildEdgesFromBatch(batch, net.eidIndex, new Set(memberEids))
  rt.viewStack.push({ kind: 'portrait', value: hub.value, members, edges })
  api.renderTopOfStack()
}

export async function enterPersonalNetwork (
  rt: NeonNetworkRuntime,
  focalIdx: number,
  api: NavigationApi,
): Promise<void> {
  const net = state.network
  if (!net) return
  const focalName = state.names?.[focalIdx]
    || state.atlas?.manifest.names[state.atlas.imageIndices[focalIdx]]
    || `person ${focalIdx}`
  hideProfilePanel()
  // Same snap-clear as portrait. The focal stays as a single dot at
  // its current location while the CSR fetch is in flight; the
  // personal-network renderer then tweens its neighbours in.
  snapClearForFocus(rt, focalIdx)
  rt.csrAbort?.abort()
  rt.csrAbort = new AbortController()
  const pnet = await fetchPersonalNetwork(focalIdx, net, rt.csrAbort.signal)
  if (!pnet || rt.csrAbort.signal.aborted) return
  rt.viewStack.push({ kind: 'personal', focalIdx, focalName, pnet })
  api.renderTopOfStack()
}

/** Synchronous "wipe the canvas" used before an async view transition.
 *  Sets every point's size to 0 except the focal, drops all links, and
 *  forces a render so the user sees the prior view collapse the instant
 *  they click. Subsequent view rendering tweens nodes back in from
 *  size 0 — the new layout enters cleanly without fighting the old. */
function snapClearForFocus (
  rt: NeonNetworkRuntime,
  focalIdx: number,
): void {
  const live = rt.ctx.graph.getPointSizes()
  const cleared = new Float32Array(live.length)
  // Keep just the focal visible at its current size so the user has a
  // visual anchor — "this is the person I clicked, networks are loading".
  cleared[focalIdx] = (live[focalIdx] as number) > 0 ? (live[focalIdx] as number) : 120
  rt.ctx.graph.setPointSizes(cleared)
  rt.ctx.graph.setLinks(new Float32Array(0))
  rt.ctx.graph.render()
  // Hub / portrait labels left over from the prior view need to go too;
  // otherwise their names hover over the empty canvas during the fetch.
  rt.hubLabelsHandle?.setVisible(false)
  rt.portraitLabelsHandle?.setVisible(false)
  rt.tooltipHandle?.hide()
}

export function exitToAtlas (rt: NeonNetworkRuntime, api: NavigationApi): void {
  if (rt.viewStack.length === 0) return
  const popped = rt.viewStack.pop()
  if (popped?.kind === 'personal') {
    rt.ctx.graph.setConfigPartial({ enableSimulation: false, enableDrag: false })
    rt.ctx.graph.setLinkWidths(new Float32Array(0))
    rt.portraitLabelsHandle?.setVisible(false)
    if (rt.viewStack.length > 0) api.renderTopOfStack()
    else tweenHome(rt)
    return
  }
  if (popped?.kind === 'portrait') {
    rt.portraitLabelsHandle?.setVisible(false)
    rt.ctx.graph.setConfigPartial({ enableDrag: false })
    rt.cancelForceRelax?.()
    rt.cancelForceRelax = null
    rt.currentPortraitAnchored = null
    rt.draggingIdx = -1
    rt.ctx.graph.setLinks(new Float32Array(0))
    rt.ctx.graph.render()
    api.renderTopOfStack()
    return
  }
  exitAllToAtlas(rt)
}

function exitAllToAtlas (rt: NeonNetworkRuntime): void {
  rt.viewStack.length = 0
  rt.csrAbort?.abort()
  rt.csrAbort = null
  rt.cancelForceRelax?.()
  rt.cancelForceRelax = null
  rt.currentPortraitAnchored = null
  rt.ctx.graph.setConfigPartial({ enableDrag: false, maxPointSizeOverride: 120 })
  rt.hubLabelsHandle?.setVisible(false)
  rt.portraitLabelsHandle?.setVisible(false)
  fadeLinkOpacityTo(rt, 0, 240, 0)
  window.setTimeout(() => {
    if (rt.viewStack.length === 0) {
      rt.ctx.graph.setLinks(new Float32Array(0))
      rt.ctx.graph.render()
    }
  }, 260)
  tweenHome(rt)
  rt.tooltipHandle?.hide()
  scheduleRingsStart(rt, 750)
}

function tweenHome (rt: NeonNetworkRuntime): void {
  const { positions, sizes } = computeGlobalState(rt, state.colorMode)
  rt.cancelLayoutTween?.()
  rt.cancelLayoutTween = tweenPositionsAndSizes(rt.ctx.graph, positions, sizes, 650)
  rt.backButtonHandle?.hide()
}

function hideProfilePanel (): void {
  const profile = document.querySelector<HTMLElement>('[data-node-explorer="profile"]')
  if (!profile) return
  profile.style.opacity = '0'
  profile.style.pointerEvents = 'none'
}
