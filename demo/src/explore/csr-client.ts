/**
 * Client for CSR's neighbourhood-graph endpoint. A single binary POST
 * returns a root entity's top-N neighbours plus the induced edges among
 * them — replacing the old fan-out of one /neighbors call + N /neighbors_batch
 * calls. Goes through the Vite dev proxy at `/csr`. Requires the VPN.
 *
 * POST /neighborhood_graph_raw  { root, max_neighbors, edge_min_score }
 *
 * Binary response (little-endian):
 *   header:    [root:u32][neighbor_count:u32][edge_count:u32]        12 B
 *   neighbors: N × [entity_int_id:u32][score_u16:u16]                 6 B each
 *   edges:     E × [src_idx:u32][dst_idx:u32][score_u16:u16]         10 B each
 * src_idx/dst_idx index into the neighbour block (src_idx < dst_idx,
 * undirected, deduped). score_u16 is raw score_fp (score_scale is 1.0).
 */

const CSR = '/csr'

export interface RawNeighbor {
  /** Neighbour entity int. */
  dst_int: number
  score: number
}

export interface InducedEdge {
  /** Indices into the neighbour block (0-based). */
  src: number
  dst: number
  score: number
}

export interface NeighborhoodGraph {
  root: number
  /** Score-descending. */
  neighbors: RawNeighbor[]
  edges: InducedEdge[]
}

export async function fetchNeighborhoodGraph (
  root: number,
  maxNeighbors: number,
  edgeMinScore: number,
): Promise<NeighborhoodGraph> {
  const res = await fetch(`${CSR}/neighborhood_graph_raw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      root,
      max_neighbors: maxNeighbors,
      edge_min_score: edgeMinScore,
    }),
  })
  if (!res.ok) throw new Error(`CSR /neighborhood_graph_raw -> ${res.status}`)
  const buf = await res.arrayBuffer()
  if (buf.byteLength < 12) throw new Error('neighborhood_graph_raw: short response')

  const view = new DataView(buf)
  const rootOut = view.getUint32(0, true)
  const neighborCount = view.getUint32(4, true)
  const edgeCount = view.getUint32(8, true)

  let pos = 12
  const neighbors: RawNeighbor[] = new Array(neighborCount)
  for (let i = 0; i < neighborCount; i += 1) {
    neighbors[i] = {
      dst_int: view.getUint32(pos, true),
      score: view.getUint16(pos + 4, true),
    }
    pos += 6
  }

  const edges: InducedEdge[] = new Array(edgeCount)
  for (let i = 0; i < edgeCount; i += 1) {
    edges[i] = {
      src: view.getUint32(pos, true),
      dst: view.getUint32(pos + 4, true),
      score: view.getUint16(pos + 8, true),
    }
    pos += 10
  }

  return { root: rootOut, neighbors, edges }
}
