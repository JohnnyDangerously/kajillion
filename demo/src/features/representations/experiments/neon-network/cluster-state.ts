import type { SlicedAttributes } from './attributes-loader'
import { COLOR_MODE_LABELS, type ColorMode } from './color-modes'
import type { LoadedNetwork } from './network-types'
import { NULL_DISPLAY, NULL_KEY, getRootIndex } from './shared'

export interface ClusterInfo {
  /** Internal key — the raw facet value, or NULL_KEY for nulls. */
  key: string;
  /** Display label for tooltips. */
  value: string;
  count: number;
  members: number[];
  /** Highest-score member — used as the endpoint for the spoke edge. */
  repNodeIdx: number;
  /** Centroid of member positions in world space (computed lazily). */
  centroid: { x: number; y: number } | null;
}

export interface ClusterIndex {
  mode: ColorMode;
  /** Field label used in tooltip text ("Market", "Industry", ...). */
  fieldLabel: string;
  byKey: Map<string, ClusterInfo>;
  /** nodeIdx → cluster key, or null for the root and for nodes with no
   *  facet value in this mode. */
  byNode: (string | null)[];
  /** Root (hop=0) index for spoke edges. -1 if no root in the network. */
  rootIdx: number;
}

/** Build the cluster index for the given color mode. Returns null in
 *  hue mode (no clusters) or when facets are missing. */
export function buildClusterIndex (
  mode: ColorMode,
  network: LoadedNetwork,
  facets: SlicedAttributes | undefined
): ClusterIndex | null {
  if (mode === 'hue' || !facets) return null
  const values = facets[mode]
  if (!values) return null

  const byKey = new Map<string, ClusterInfo>()
  const byNode: (string | null)[] = new Array(network.nodeCount).fill(null)
  const rootIdx = getRootIndex(network)

  for (let i = 0; i < network.nodeCount; i += 1) {
    if (i === rootIdx) continue
    const raw = values[i] ?? NULL_KEY
    const key = raw || NULL_KEY
    byNode[i] = key
    let info = byKey.get(key)
    if (!info) {
      info = {
        key,
        value: key === NULL_KEY ? NULL_DISPLAY : key,
        count: 0,
        members: [],
        repNodeIdx: i,
        centroid: null,
      }
      byKey.set(key, info)
    }
    info.members.push(i)
    info.count += 1
    if ((network.scores[i] ?? 0) > (network.scores[info.repNodeIdx] ?? 0)) {
      info.repNodeIdx = i
    }
  }

  return {
    mode,
    fieldLabel: COLOR_MODE_LABELS[mode],
    byKey,
    byNode,
    rootIdx,
  }
}

/** Update centroids from a positions snapshot. Mutates the cluster infos
 *  so subsequent tooltip / zoom calls have fresh coordinates without
 *  re-walking the positions array. */
export function refreshClusterCentroids (
  index: ClusterIndex,
  positions: Float32Array
): void {
  for (const info of index.byKey.values()) {
    let sx = 0
    let sy = 0
    for (const idx of info.members) {
      sx += positions[idx * 2] as number
      sy += positions[(idx * 2) + 1] as number
    }
    info.centroid = info.count > 0
      ? { x: sx / info.count, y: sy / info.count }
      : null
  }
}
