/**
 * Shared types for the explore module. This is the only contract between
 * the explore workflow and the renderer — the explore code never reaches
 * into main.ts internals; it talks through an ExploreAdapter.
 */

/** A skeleton = node positions + cheap spoke edges, loaded in one shot. */
export interface SkeletonPayload {
  graphId: string
  title: string
  nodeCount: number
  /** Flat [x0, y0, x1, y1, ...]; index 0 is always the focus node. */
  positions: number[]
  /** Flat node-index pairs: focus -> each neighbor. */
  spokeLinks: number[]
}

/**
 * The renderer seam. main.ts builds one of these and hands it to
 * initExplore(); the explore module depends on nothing else.
 */
export interface ExploreAdapter {
  /** Coordinate space size (e.g. 8192); layout centers within it. */
  spaceSize: number
  /** Replace the graph with a fresh skeleton. Resolves when on screen. */
  loadSkeleton: (payload: SkeletonPayload) => Promise<void>
  /** Append mesh edges to the live graph without a rebuild. */
  appendEdges: (links: number[]) => void
  /** Re-place every node (flat [x,y,...]); used to settle the layout. */
  setPositions: (positions: number[]) => void
  /** Override every node's colour (flat [r,g,b,a,...]). */
  setColors: (colors: number[]) => void
  /** Register a callback fired when the user clicks a node (by index). */
  registerNodeClick: (cb: (nodeIndex: number) => void) => void
}

/** A resolved 1-hop ego-network from one /neighborhood_graph_raw call. */
export interface EgoNet {
  root: number
  /** Neighbour entity ints, sorted by tie score descending. */
  neighborIds: number[]
  neighborScores: number[]
  /** Flat index pairs into ordered = [root, ...neighborIds]. */
  interEdges: number[]
  /** Per-node community colours (flat RGBA), cached after first compute. */
  communityColorCache?: number[]
  /** Number of communities detected, cached alongside the colours. */
  communityGroups?: number
}
