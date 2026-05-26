# Node Explorer Feature

Graph-agnostic UI layer that composes onto any representation. Reps hand
in a `Cosmos.Graph` and an `ExplorerNetwork` (per-node ids/names/avatars/
hops/scores) and get a top-bar + profile panel + camera presets +
highlight/skitter helpers for free.

## Public API

```ts
import { mountNodeExplorer } from '../node-explorer'

const handle = mountNodeExplorer({
  graph,            // Cosmos.Graph
  host: ctx.host,   // DOM element to anchor against
  network: {
    nodeCount, eids, names, avatarUrls, hops?, scores?
  },
  facets?: {        // optional, phase-2
    companies, industries, jobTitles, jobFunctions
  }
})

// later, in the rep's teardown:
handle.dispose()
```

`dispose()` removes the top bar, profile panel, click listener, and any
in-flight animation. Reps MUST call it in their `install` teardown so
state does not leak across graph rebuilds.

## Files

- `index.ts` — orchestrator + public mount/dispose.
- `types.ts` — public interfaces.
- `profile-panel.ts` — fixed right-anchored HTML overlay, opened on
  node click, dismissed with `×` or Escape.
- `explorer-bar.ts` — fixed top-anchored pill bar with named buttons.
- `highlight-policy.ts` — wraps Cosmos's `highlightedPointIndices` +
  `pointGreyoutOpacity` for "show subset, dim others".
- `skitter-animation.ts` — animates a subset of positions to a tight
  central cluster, with a separate restore animation back to the
  layout positions.
- `focus-zoom.ts` — camera presets: `fitView`, `workZoom` (~25% out),
  `zoomToNode` (frames a single node).

## Phase status

- **Phase 1a — profile panel + work zoom**: shipped. No new data required.
- **Phase 1b — highlight + skitter**: shipped. Uses node-index subsets
  derived from the existing network (hops, random sampling, etc.).
- **Phase 2 — facet filters**: not yet wired. Requires the RDS query in
  `scripts/build-network-atlas.py` to be extended with company /
  industry / job title columns and a derived job-function classification,
  written to an `attributes.json` alongside the photo manifest. The
  `ExplorerFacets` shape is in place and the profile panel already reads
  it; only the UI bar buttons + loader need to be added.

## Reuse outside neon-network

Any representation that can produce an `ExplorerNetwork` qualifies.
Atlas-reference could expose its node names and a synthetic hop=1 for
everyone. Neon-glass could pass the headshot manifest. Each rep is
responsible for converting its internal data into the explorer's typed
shape — the explorer never imports from a specific rep.
