import type { Graph } from '@kajillion/graph'
import { mountNodeExplorer, type ExplorerHandle } from '../../../node-explorer'
import { loadAttributesManifest, sliceByRenderIndex, type SlicedAttributes } from './attributes-loader'
import type { LoadedNetwork } from './network-types'
import type { LoadedNetworkAtlas } from './atlas-loader'

/**
 * Convert the rep's internal network + atlas state into the typed
 * `ExplorerNetwork` shape the node-explorer feature expects, then mount.
 * Centralises the adapter so preset.ts stays focused on lifecycle.
 */
export async function mountExplorerForNetwork (
  graph: Graph,
  host: HTMLElement,
  network: LoadedNetwork,
  atlas: LoadedNetworkAtlas | null,
  preloadedFacets: SlicedAttributes | null = null,
  callbacks: { onNodeClicked?: (idx: number) => void; onExitFocus?: () => void; onExplore?: (idx: number) => void } = {}
): Promise<ExplorerHandle> {
  const manifest = atlas?.manifest
  const names: string[] = new Array(network.nodeCount).fill('')
  if (manifest) {
    for (let i = 0; i < manifest.photo_count; i += 1) {
      const renderIdx = manifest.photoed_render_indices[i]
      if (renderIdx !== undefined && manifest.names[i] !== undefined) {
        names[renderIdx] = manifest.names[i] as string
      }
    }
  }
  // Phase 2 will populate per-node avatar URLs once we serve raw cells.
  // For now the profile panel falls back to its first-letter stub.
  const avatarUrls: (string | null)[] = new Array(network.nodeCount).fill(null)

  let facets: SlicedAttributes | undefined = preloadedFacets ?? undefined
  if (!facets) {
    const manifest = await loadAttributesManifest()
    if (manifest) facets = sliceByRenderIndex(manifest, network.eids)
  }

  return mountNodeExplorer({
    graph,
    host,
    network: {
      nodeCount: network.nodeCount,
      eids: network.eids,
      names,
      avatarUrls,
      hops: network.hops,
      scores: network.scores,
    },
    facets,
    onNodeClicked: callbacks.onNodeClicked,
    onExitFocus: callbacks.onExitFocus,
    onExplore: callbacks.onExplore,
  })
}
