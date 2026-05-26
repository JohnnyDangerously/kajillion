import { buildEdgesFromBatch, fetchNeighborsBatch } from './csr-client'
import type { LoadedNetwork } from './network-types'
import { GOLDEN_ANGLE } from './shared'

const MAX_ONE_HOP = 80
const MIN_RADIUS = 700
const SPREAD_RADIUS = 3200
const FOCAL_SIZE = 280
const NODE_SIZE = 170

export interface PersonalNetwork {
  /** Focal render index — the "you" of this view. */
  focalIdx: number;
  /** Render indices of every visible node, focal first. */
  nodeIndices: number[];
  /** Within-set edges as flat [src, dst, …] pairs of render indices. */
  edges: Float32Array;
  /** Per-edge CSR score, parallel to edges/2. Used for variable
   *  link widths so high-affinity connections feel weighty. */
  edgeWeights: Float32Array;
}

/**
 * Fetch the full 1-hop ego network for a focal person from CSR.
 * Returns the focal + their bin-intersected neighbours, plus every
 * within-set edge derived by walking each neighbour's neighbourhood.
 *
 * Two CSR calls: one for the focal's direct neighbours, one big
 * batched call that walks all in-bin neighbours so we can build dense
 * within-set edges. The server's 20 GiB cache makes warm calls free.
 *
 * Returns null on any fetch failure so the caller can degrade
 * gracefully (e.g. fall back to the simpler portrait close-up).
 */
export async function fetchPersonalNetwork (
  focalIdx: number,
  network: LoadedNetwork,
  signal: AbortSignal,
): Promise<PersonalNetwork | null> {
  const focalEid = network.eids[focalIdx] as number
  const oneHop = await fetchNeighborsBatch([focalEid], MAX_ONE_HOP, signal)
  if (!oneHop || signal.aborted) return null

  const raw = oneHop.results[String(focalEid)] ?? []
  const inBin: Array<{ idx: number; eid: number; score: number }> = []
  for (const n of raw) {
    if (n.dst_int === focalEid) continue
    const idx = network.eidIndex.get(n.dst_int)
    if (idx === undefined) continue
    inBin.push({ idx, eid: n.dst_int, score: n.score })
    if (inBin.length >= MAX_ONE_HOP) break
  }
  if (inBin.length === 0) return null

  // All node ids in this view, focal first.
  const nodeIndices = [focalIdx, ...inBin.map(n => n.idx)]
  const allEids = [focalEid, ...inBin.map(n => n.eid)]

  // Walk everyone's neighbourhood; filter to within-set so we get
  // strong inner connectivity that creates the multi-community feel.
  const batch = await fetchNeighborsBatch(allEids, 30, signal)
  if (!batch || signal.aborted) return null
  const setEids = new Set(allEids)
  const edges = buildEdgesFromBatch(batch, network.eidIndex, setEids)

  // Derive a weight per edge so the renderer can vary linkWidth by
  // affinity. We pull the score from whichever direction reported it
  // (CSR is undirected for our purposes; max(src→dst, dst→src) gives
  // the strongest signal).
  const edgeCount = edges.length / 2
  const edgeWeights = new Float32Array(edgeCount)
  // Build a score lookup keyed by min(eid)<<32 | max(eid).
  const edgeScore = new Map<bigint, number>()
  for (const [srcStr, ns] of Object.entries(batch.results)) {
    const srcEid = Number(srcStr)
    for (const n of ns) {
      const dstEid = n.dst_int
      if (!setEids.has(srcEid) || !setEids.has(dstEid)) continue
      const lo = Math.min(srcEid, dstEid)
      const hi = Math.max(srcEid, dstEid)
      const key = (BigInt(hi) << 32n) | BigInt(lo)
      const prev = edgeScore.get(key) ?? 0
      if (n.score > prev) edgeScore.set(key, n.score)
    }
  }
  for (let i = 0; i < edgeCount; i += 1) {
    const a = edges[i * 2] as number
    const b = edges[(i * 2) + 1] as number
    const aEid = network.eids[a] as number
    const bEid = network.eids[b] as number
    const lo = Math.min(aEid, bEid)
    const hi = Math.max(aEid, bEid)
    const key = (BigInt(hi) << 32n) | BigInt(lo)
    edgeWeights[i] = edgeScore.get(key) ?? 1
  }
  return { focalIdx, nodeIndices, edges, edgeWeights }
}

/**
 * Initial-position layout for a personal network. Focal pinned at the
 * centre, neighbours golden-spiraled outward with highest-score nodes
 * placed nearest the centre. The intent is to give the force simulator
 * a non-degenerate starting point; the final shape is then determined
 * by Cosmos's d3-force physics, NOT this spread.
 */
export function buildPersonalNetworkLayout (
  network: LoadedNetwork,
  pnet: PersonalNetwork,
  prevPositions: Float32Array,
  centre: { x: number; y: number },
): { positions: Float32Array; sizes: Float32Array; faces: Array<{ idx: number; x: number; y: number; isFocal: boolean }> } {
  const positions = new Float32Array(prevPositions)
  // Engine-pointCount-sized sizes array. A 5,157-long array on a
  // 19,500-slot engine triggers the length-mismatch fallback to
  // pointDefaultSize for everyone — same drill-in bug class as
  // portrait-view; see comment there for details.
  const sizes = new Float32Array(positions.length / 2)
  const faces: Array<{ idx: number; x: number; y: number; isFocal: boolean }> = []

  positions[pnet.focalIdx * 2] = centre.x
  positions[(pnet.focalIdx * 2) + 1] = centre.y
  sizes[pnet.focalIdx] = FOCAL_SIZE
  faces.push({ idx: pnet.focalIdx, x: centre.x, y: centre.y, isFocal: true })

  // Others by score so the simulator starts with important nodes nearer
  // the centre — minor cue but it helps the layout settle pleasantly.
  const others = pnet.nodeIndices.filter(i => i !== pnet.focalIdx)
  others.sort((a, b) => (network.scores[b] ?? 0) - (network.scores[a] ?? 0))

  for (let j = 0; j < others.length; j += 1) {
    const t = (j + 0.5) / others.length
    const r = MIN_RADIUS + (Math.sqrt(t) * SPREAD_RADIUS)
    const theta = j * GOLDEN_ANGLE
    const idx = others[j] as number
    const x = centre.x + (Math.cos(theta) * r)
    const y = centre.y + (Math.sin(theta) * r)
    positions[idx * 2] = x
    positions[(idx * 2) + 1] = y
    sizes[idx] = NODE_SIZE
    faces.push({ idx, x, y, isFocal: false })
  }
  return { positions, sizes, faces }
}
