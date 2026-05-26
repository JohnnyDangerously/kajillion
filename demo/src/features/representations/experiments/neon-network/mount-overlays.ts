import { createBackButton } from './back-button'
import { buildTargetAttributes, state } from './cache'
import { createColorBar } from './color-bar'
import { buildHueLookup, type ColorMode } from './color-modes'
import { createHubLabels } from './hub-labels'
import { mountExplorerForNetwork } from './explorer-mount'
import { createPortraitLabels } from './portrait-labels'
import type { NeonNetworkRuntime } from './runtime'
import { computeGlobalState, fadeLinkOpacityTo, refreshClusterIndex, scheduleRingsStart, stopRings, TARGET_LINK_OPACITY } from './runtime-actions'
import { getRootIndex } from './shared'
import { tweenPositionsAndSizes } from './layout-tween'
import { logAbortable } from './dev-hooks'

export interface OverlayActions {
  exitToAtlas: () => void;
  enterExplode: (idx: number) => void;
  enterPortraitFromHub: (hub: Parameters<typeof createHubLabels>[1] extends (h: infer H) => void ? H : never) => Promise<void>;
  enterPersonalNetwork: (idx: number) => Promise<void>;
}

export async function mountNeonOverlays (
  rt: NeonNetworkRuntime,
  actions: OverlayActions,
): Promise<void> {
  rt.backButtonHandle = createBackButton(actions.exitToAtlas)
  rt.hubLabelsHandle = createHubLabels(rt.ctx.graph, (hub) => {
    actions.enterPortraitFromHub(hub).catch(logAbortable('portrait fetch failed'))
  })
  rt.portraitLabelsHandle = createPortraitLabels(rt.ctx.graph)
  if (state.network) {
    const handle = await mountExplorerForNetwork(
      rt.ctx.graph,
      rt.ctx.host,
      state.network,
      state.atlas,
      state.facets,
      {
        onExitFocus: actions.exitToAtlas,
        onNodeClicked: actions.enterExplode,
        onExplore: idx => actions.enterPersonalNetwork(idx).catch(logAbortable('personal fetch failed')),
      },
    )
    if (rt.cancelled) handle.dispose()
    else rt.explorerHandle = handle
  }
  if (!rt.cancelled && state.network) mountColorBar(rt)
}

function fitCameraToPositions (
  rt: NeonNetworkRuntime,
  positions: Float32Array,
  padding: number,
  durationMs: number,
): void {
  // Only bin nodes participate — starfield positions trail the bin and
  // would explode the bounding box. Without this clamp the camera would
  // fit a ~60k-radius box and the disc would be 30px wide.
  const net = state.network
  const limit = net ? net.nodeCount : positions.length / 2
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let i = 0; i < limit; i += 1) {
    const x = positions[i * 2] as number
    const y = positions[(i * 2) + 1] as number
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  if (!Number.isFinite(minX)) return
  const box = new Float32Array([minX, minY, maxX, maxY])
  rt.ctx.graph.setZoomTransformByPointPositions(box, durationMs, undefined, padding, false)
}

/** Build one spoke per cluster, from John to the highest-scoring
 *  member of that cluster. Reads as a "centre is connected to each
 *  community" cue and gives the cluster blobs something to anchor to
 *  rather than floating in space. */
function buildClusterCentroidSpokes (
  rt: NeonNetworkRuntime,
  mode: ColorMode,
): Float32Array {
  const net = state.network
  const facets = state.facets
  if (!net || !facets || mode === 'hue') return new Float32Array(0)
  const values = facets[mode]
  if (!values) return new Float32Array(0)
  const rootIdx = getRootIndex(net)
  if (rootIdx < 0) return new Float32Array(0)
  // One representative per facet value — the highest-score member.
  const bestPerValue = new Map<string, number>()
  for (let i = 0; i < net.nodeCount; i += 1) {
    if (i === rootIdx) continue
    const v = values[i]
    if (!v) continue
    const cur = bestPerValue.get(v)
    if (cur === undefined || (net.scores[i] ?? 0) > (net.scores[cur] ?? 0)) {
      bestPerValue.set(v, i)
    }
  }
  const edges = new Float32Array(bestPerValue.size * 2)
  let w = 0
  for (const idx of bestPerValue.values()) {
    edges[w] = rootIdx
    edges[w + 1] = idx
    w += 2
  }
  return edges
}

function mountColorBar (rt: NeonNetworkRuntime): void {
  const facetModes: ColorMode[] = state.facets
    ? ['markets', 'levels', 'functions', 'industries', 'companies']
    : []
  rt.colorBarHandle = createColorBar({
    modes: ['hue', ...facetModes],
    initial: state.colorMode,
    onChange: (mode) => {
      rt.viewStack.length = 0
      rt.backButtonHandle?.hide()
      stopRings(rt)
      state.colorMode = mode
      const net = state.network
      if (!net) return
      rt.ctx.graph.setPointColors(buildTargetAttributes(rt.ctx.data.nodeCount).colors)
      if (state.atlas) {
        const hueLookup = buildHueLookup(mode, net.eids, state.facets ?? undefined)
        rt.ctx.graph.setImageData(state.atlas.recolor(hueLookup))
      }
      const { positions, sizes } = computeGlobalState(rt, mode)
      rt.cancelLayoutTween?.()
      rt.cancelLayoutTween = tweenPositionsAndSizes(rt.ctx.graph, positions, sizes, 700)
      refreshClusterIndex(rt, mode, positions)
      // Refit the camera to the new layout's bounding box. Without this
      // the cluster blobs render tiny + off-centre because the camera
      // stays at the wide atlas FIT_RADIUS even though cluster mode
      // packs everything into a fraction of that area.
      fitCameraToPositions(rt, positions, mode === 'hue' ? 0.04 : 0.12, 700)
      // Cluster modes get John→representative spokes drawn from the
      // centre outward to each cluster. Hue mode drops them again.
      if (mode === 'hue') {
        rt.ctx.graph.setLinks(new Float32Array(0))
        fadeLinkOpacityTo(rt, 0, 200, 0)
      } else {
        rt.ctx.graph.setLinks(buildClusterCentroidSpokes(rt, mode))
        fadeLinkOpacityTo(rt, TARGET_LINK_OPACITY, 200, 200)
      }
      scheduleRingsStart(rt, 750)
    },
  })
}
