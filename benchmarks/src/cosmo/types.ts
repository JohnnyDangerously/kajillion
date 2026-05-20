export interface CosmoLabOptions {
  count: number;
  /** Number of communities. Same default as cosmo-lab:
   *  max(8, min(20, round(log2(count) - 3))). */
  communityCount?: number;
  /** Average intra-community edges per node. */
  intraDensity?: number;
  /** Fraction of total nodes that get one cross-community bridge edge. */
  bridgeFraction?: number;
  /** Seed for reproducible generation. */
  seed?: number;
  /**
   * Initial layout shape. Keep the default `cosmo` for benchmark parity with
   * cosmo-lab; the demo can opt into `organic` so dense communities do not
   * start as visible square clouds.
   */
  layoutStyle?: 'cosmo' | 'organic';
}

export interface CommunityRange {
  start: number;
  end: number;
}

export interface CommunityOrigin {
  cx: number;
  cy: number;
}
