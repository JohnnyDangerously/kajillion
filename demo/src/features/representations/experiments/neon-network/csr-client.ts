/**
 * CSR / Wayfinder client for the neon-network rep.
 *
 * Vite dev server proxies `/csr/*` → CSR's private internal host (VPN-only).
 * If the fetch fails (offline, no VPN), callers should fall back gracefully
 * — every helper returns null on failure rather than throwing.
 *
 * CSR exposes integer entity IDs only. The render-index translation
 * lives in the rep (using LoadedNetwork.eidIndex).
 */

const NEIGHBORS_BATCH_URL = '/csr/neighbors_batch'

export interface NeighborsBatchResponse {
  /** `{ "51197947": [{ dst_int, score }, …], … }` — src_int keys are
   *  serialised as strings in JSON. */
  results: Record<string, Array<{ dst_int: number; score: number }>>;
}

/**
 * Fetch each src's top-N 1-hop neighbours in a single batched POST.
 * Returns null on any network / parse error so callers can degrade
 * silently (e.g. fall back to synthesised edges).
 *
 * The server's 20 GiB moka cache makes repeated calls for the same
 * src_ints essentially free, so you can call this on every explode
 * without worrying about cost.
 */
export async function fetchNeighborsBatch (
  srcInts: number[],
  limit = 100,
  signal?: AbortSignal,
): Promise<NeighborsBatchResponse | null> {
  if (srcInts.length === 0) return { results: {} }
  try {
    const res = await fetch(NEIGHBORS_BATCH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ src_ints: srcInts, limit }),
      signal,
    })
    if (!res.ok) {
      console.warn('[csr] neighbors_batch HTTP', res.status)
      return null
    }
    return (await res.json()) as NeighborsBatchResponse
  } catch (err) {
    if ((err as Error).name === 'AbortError') return null
    console.warn('[csr] neighbors_batch failed:', err)
    return null
  }
}

/**
 * Given a CSR neighbors_batch result and the set of entity_int_ids that
 * are part of the current cluster, produce the *within-cluster* edges
 * (both endpoints belong to the cluster) translated to render indices.
 *
 * `eidToRender`: render-index lookup, typically `LoadedNetwork.eidIndex`.
 * `clusterEids`: set of every eid in the cluster, for the within-cluster
 *   filter. We dedupe edges (a→b and b→a both seen in the batch produce
 *   one undirected edge) using a packed-pair key.
 */
export function buildEdgesFromBatch (
  batch: NeighborsBatchResponse,
  eidToRender: Map<number, number>,
  clusterEids: Set<number>,
): Float32Array {
  const seen = new Set<bigint>()
  const flat: number[] = []
  for (const [srcStr, neighbours] of Object.entries(batch.results)) {
    const srcEid = Number(srcStr)
    if (!clusterEids.has(srcEid)) continue
    const srcRender = eidToRender.get(srcEid)
    if (srcRender === undefined) continue
    for (const n of neighbours) {
      const dstEid = n.dst_int
      if (dstEid === srcEid) continue
      if (!clusterEids.has(dstEid)) continue
      const dstRender = eidToRender.get(dstEid)
      if (dstRender === undefined) continue
      // Pack the unordered pair into a single 64-bit key so we don't
      // emit (a,b) and (b,a) as two edges. min/max ensures order.
      const lo = Math.min(srcRender, dstRender)
      const hi = Math.max(srcRender, dstRender)
      const key = (BigInt(hi) << 32n) | BigInt(lo)
      if (seen.has(key)) continue
      seen.add(key)
      flat.push(srcRender, dstRender)
    }
  }
  return new Float32Array(flat)
}
