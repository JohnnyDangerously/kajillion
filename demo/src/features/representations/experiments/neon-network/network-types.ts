export interface NetworkNode {
  /** Stable entity id from CSR. */
  eid: number;
  /** 0 = root (John), 1 = first-degree, 2 = second-degree. */
  hop: number;
  score: number;
}

export interface LoadedNetwork {
  nodeCount: number;
  /** Concatenated x,y per node — pass straight to Cosmos. */
  positions: Float32Array;
  /** Per-node entity id, in render index order. */
  eids: Uint32Array;
  hops: Uint8Array;
  scores: Float32Array;
  /** eid → render index. */
  eidIndex: Map<number, number>;
  /** Max distance from disc centre for snug halo placement. */
  outerRadius: number;
}
