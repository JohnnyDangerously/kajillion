import type { Graph } from '@kajillion/graph'

/**
 * The minimum-viable description of a graph the explorer can operate on.
 * Any representation that wants to opt into the explorer feature hands one
 * of these in. The explorer never touches the rep-specific layout or
 * style code; it only reads identifiers + per-node attributes and writes
 * highlight indices / position overrides back through the Graph.
 */
export interface ExplorerNetwork {
  nodeCount: number;
  /** Per-node entity id (stable across rebuilds). */
  eids: Uint32Array;
  /** Per-node display name. May be empty string for unknowns. */
  names: string[];
  /** Per-node URL to a 128 px circular avatar, or null. */
  avatarUrls: (string | null)[];
  /** Per-node hop distance from the root (0 = root). */
  hops?: Uint8Array;
  /** Per-node CSR score. Higher = more important. */
  scores?: Float32Array;
}

/**
 * Optional facet manifest — Phase 2. Each array is parallel to `eids`.
 * If omitted, facet UI surfaces stay empty / hidden.
 */
export interface ExplorerFacets {
  companies?: (string | null)[];
  industries?: (string | null)[];
  markets?: (string | null)[];
  titles?: (string | null)[];
  functions?: (string | null)[];
  levels?: (string | null)[];
}

export interface ExplorerMountOptions {
  graph: Graph;
  /** DOM element to anchor floating UI to (e.g. graphHost). */
  host: HTMLElement;
  network: ExplorerNetwork;
  facets?: ExplorerFacets;
  /** Fired on every node click alongside the profile panel opening. Lets
   *  reps add cluster-zoom / camera moves without having to fight the
   *  explorer for the onPointClick slot. */
  onNodeClicked?: (nodeIndex: number) => void;
  /** Explicit "Explore this person's network" action. When supplied,
   *  the profile panel renders a button that fires this with the
   *  clicked render index. Reps decide what the action means; we use
   *  it to push a personal-network view onto the stack. */
  onExplore?: (nodeIndex: number) => void;
  /** Exit-current-view handler. When supplied, the explorer wires Escape
   *  to call it. Reps decide what "exit" means — currently used to pop
   *  one level off the explode stack. */
  onExitFocus?: () => void;
}

export interface ExplorerHandle {
  dispose: () => void;
}
