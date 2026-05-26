import type { NeighborsBatchResponse } from './csr-client'
import type { LoadedNetwork } from './network-types'

const RING_RADIUS = 4600
const SATELLITE_SIZE = 36
const DEFAULT_MAX = 60

export interface SatelliteRing {
  /** Per-satellite render index. Length = number of satellites rendered. */
  indices: Int32Array;
  /** World-space [x, y] coordinates flat-packed, length = indices.length * 2. */
  positions: Float32Array;
  /** Cross-cluster edges to satellites, [src, dst, …] in render-index form. */
  edges: Float32Array;
  /** Display size for satellite dots, used by the size mask. */
  size: number;
}

/**
 * Derive a "satellite halo" from a CSR neighbours batch — small dots
 * arranged on a ring just outside the cluster disc, representing the
 * top outside-cluster neighbours of the cluster's members. Cross-cluster
 * edges land at these satellites instead of disappearing into invisible
 * non-cluster positions, so the user can SEE who the cluster reaches.
 *
 * Top-N is chosen by the best score any cluster member had against that
 * outside person — strongest ties surface first.
 *
 * Satellite angle is derived from each outside person's ORIGINAL bin
 * position (atan2 from disc centre). Two effects this is meant to
 * produce: a satellite stays in the direction it "belongs" in the
 * underlying network layout (so a satellite in the upper-right keeps
 * roughly that orientation across explodes), and satellites for related
 * outside people naturally cluster on the ring.
 */
export function buildSatelliteRing (
  batch: NeighborsBatchResponse,
  net: LoadedNetwork,
  clusterEids: Set<number>,
  centre: { x: number; y: number },
  max: number = DEFAULT_MAX,
): SatelliteRing {
  // Walk the batch: for each outside-cluster neighbour, keep the
  // highest score seen across all cluster sources + the list of source
  // render indices so we can emit edges.
  const bestScore = new Map<number, number>()
  const sourcesOf = new Map<number, number[]>()
  for (const [srcStr, neighbours] of Object.entries(batch.results)) {
    const srcEid = Number(srcStr)
    if (!clusterEids.has(srcEid)) continue
    const srcRender = net.eidIndex.get(srcEid)
    if (srcRender === undefined) continue
    for (const n of neighbours) {
      const dstEid = n.dst_int
      if (dstEid === srcEid) continue
      if (clusterEids.has(dstEid)) continue
      const dstRender = net.eidIndex.get(dstEid)
      if (dstRender === undefined) continue
      const prev = bestScore.get(dstEid)
      if (prev === undefined || n.score > prev) bestScore.set(dstEid, n.score)
      let srcs = sourcesOf.get(dstEid)
      if (!srcs) { srcs = []; sourcesOf.set(dstEid, srcs) }
      srcs.push(srcRender)
    }
  }

  const sorted = [...bestScore.entries()].sort((a, b) => b[1] - a[1]).slice(0, max)
  const indices = new Int32Array(sorted.length)
  const positions = new Float32Array(sorted.length * 2)
  const edgesFlat: number[] = []
  for (let i = 0; i < sorted.length; i += 1) {
    const eid = sorted[i]![0]
    const renderIdx = net.eidIndex.get(eid)!
    indices[i] = renderIdx
    // Use the bin's original position to derive a stable angle from
    // John for this outside person.
    const dx = (net.positions[renderIdx * 2] as number) - centre.x
    const dy = (net.positions[(renderIdx * 2) + 1] as number) - centre.y
    const theta = Math.atan2(dy, dx)
    positions[i * 2] = centre.x + (Math.cos(theta) * RING_RADIUS)
    positions[(i * 2) + 1] = centre.y + (Math.sin(theta) * RING_RADIUS)
    const sources = sourcesOf.get(eid)!
    // Dedupe sources — the same cluster member can appear multiple
    // times if CSR returned multiple links between them.
    const uniqueSources = [...new Set(sources)]
    for (const srcRender of uniqueSources) {
      edgesFlat.push(srcRender, renderIdx)
    }
  }
  return {
    indices,
    positions,
    edges: new Float32Array(edgesFlat),
    size: SATELLITE_SIZE,
  }
}
