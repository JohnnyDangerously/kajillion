/**
 * Explore workflow: click a node → panel → Explore → that node's network
 * loads and becomes the focus. Endless graph-walking.
 *
 * Loading model — one binary call per jump:
 *   /neighborhood_graph_raw returns the root's neighbours AND the induced
 *   edges among them in a single response. We seed every node's position,
 *   load the skeleton, append the induced edges, and let the renderer's
 *   force sim reshape it into organic clusters. Communities then drive
 *   node colour.
 *
 * This module owns interaction + data orchestration only. It touches the
 * renderer exclusively through the ExploreAdapter passed to initExplore().
 */
import type { ExploreAdapter, EgoNet, SkeletonPayload } from './types'
import { fetchNeighborhoodGraph } from './csr-client'
import { radialLayout } from './layout'
import { detectCommunities, rankCommunitiesBySize } from './communities'
import { uniformColors, communityColors } from './palette'
import { Traversal } from './traversal'
import { ExplorePanel } from './panel'

/** Server caps the neighbour set at 40k; ask for everything up to that. */
const MAX_NEIGHBORS = 40_000
/** Only request inter-neighbour edges at/above this tie score — connected
 *  does not mean worth drawing. The server filters; this is the threshold. */
const MIN_EDGE_SCORE = 20

export function initExplore (adapter: ExploreAdapter, seedEntityInt: number): void {
  const panel = new ExplorePanel()
  const traversal = new Traversal()

  // State for the currently-rendered network.
  let orderedIds: number[] = []
  let scoreByIndex: number[] = []
  let generation = 0
  let busy = false

  async function resolveEgoNet (entityInt: number): Promise<EgoNet> {
    const cached = traversal.getCached(entityInt)
    if (cached) return cached
    const g = await fetchNeighborhoodGraph(entityInt, MAX_NEIGHBORS, MIN_EDGE_SCORE)
    // Edge indices are into the neighbour block; ordered = [root, ...neighbors]
    // puts the root at 0, so neighbour index k maps to ordered index k + 1.
    const interEdges: number[] = new Array(g.edges.length * 2)
    for (let i = 0; i < g.edges.length; i += 1) {
      interEdges[i * 2] = g.edges[i]!.src + 1
      interEdges[i * 2 + 1] = g.edges[i]!.dst + 1
    }
    return {
      root: entityInt,
      neighborIds: g.neighbors.map((n) => n.dst_int),
      neighborScores: g.neighbors.map((n) => n.score),
      interEdges,
    }
  }

  /** Detect communities from the induced edges and recolour by cluster. */
  function recolorByCommunities (net: EgoNet, gen: number): void {
    if (gen !== generation || net.neighborIds.length < 8) return
    let colors = net.communityColorCache
    if (!colors) {
      const labels = detectCommunities(orderedIds.length, net.interEdges)
      const ranks = rankCommunitiesBySize(labels)
      colors = communityColors(labels, ranks)
      net.communityColorCache = colors
      net.communityGroups = ranks.size
    }
    adapter.setColors(colors)
    panel.setStatus(
      `Network ready · ${net.neighborIds.length.toLocaleString()} ties · `
      + `${net.communityGroups ?? 0} communities`,
    )
  }

  async function loadNetwork (entityInt: number, gen: number): Promise<void> {
    busy = true
    panel.setBusy(true)
    panel.setStatus('Fetching neighborhood…')
    try {
      const net = await resolveEgoNet(entityInt)
      if (gen !== generation) return
      traversal.put(net)

      const ordered = [net.root, ...net.neighborIds]
      // Seed positions for the force sim — it reshapes from here.
      const positions = radialLayout(net.neighborIds.length, adapter.spaceSize)
      const spokeLinks: number[] = []
      for (let i = 1; i < ordered.length; i += 1) spokeLinks.push(0, i)

      const payload: SkeletonPayload = {
        graphId: `ego-${entityInt}`,
        title: `#${entityInt}`,
        nodeCount: ordered.length,
        positions,
        spokeLinks,
      }
      panel.setStatus(`Loading ${net.neighborIds.length.toLocaleString()} nodes…`)
      await adapter.loadSkeleton(payload)
      if (gen !== generation) return

      // Replace the demo's angle-bucketed rainbow with a calm scheme.
      adapter.setColors(uniformColors(ordered.length))
      orderedIds = ordered
      scoreByIndex = [0, ...net.neighborScores]
      panel.hide()
      panel.setBreadcrumb(traversal.history)

      adapter.appendEdges(net.interEdges)
      recolorByCommunities(net, gen)
    } catch (err) {
      panel.setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      busy = false
      panel.setBusy(false)
    }
  }

  function jumpTo (entityInt: number): void {
    if (busy) return
    traversal.enter(entityInt)
    generation += 1
    void loadNetwork(entityInt, generation)
  }

  function jumpBack (): void {
    if (busy) return
    const prev = traversal.back()
    if (prev === null) return
    generation += 1
    void loadNetwork(prev, generation)
  }

  function onNodeClick (nodeIndex: number): void {
    const entityInt = orderedIds[nodeIndex]
    if (entityInt === undefined) return
    const isFocus = nodeIndex === 0
    panel.show({
      entityInt,
      isFocus,
      scoreToFocus: isFocus ? undefined : scoreByIndex[nodeIndex],
      degree: isFocus ? orderedIds.length - 1 : undefined,
    })
  }

  panel.setHandlers(jumpTo, jumpBack)
  adapter.registerNodeClick(onNodeClick)

  // Initial load — the seed network is the first focus.
  jumpTo(seedEntityInt)
}
