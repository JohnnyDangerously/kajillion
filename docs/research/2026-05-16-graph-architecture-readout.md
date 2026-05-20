# Kajillion Graph Architecture Readout

Date: 2026-05-16

## Goal

Kajillion should win on three axes at the same time:

1. **Graphical graph:** a serious high-scale WebGPU graph renderer that stays fast under stress.
2. **Beauty:** graph views that look intentionally designed, not like a generic hairball.
3. **Workflow:** interaction patterns that make graph work understandable, bounded, and useful.

The core decision is to build a custom data-oriented graph scene engine around the WebGPU renderer, not to drop in a generic graph/UI/rules library as the runtime.

## Recommended Spine

```txt
Graph/API input
  -> GraphStore / ViewGraph
  -> SceneCompiler
  -> CompiledVisualScene
  -> WebGPU FrameGraph
  -> Interaction + Workflow Controller
```

The product-facing API can be expressive. The hot path must be boring:

- numeric ids
- typed arrays
- storage buffers
- dirty ranges
- visible lists
- indirect draws
- explicit render/compute passes

No string matching, rule interpretation, React state, UI accessors, or graph semantics should run inside the per-frame render path.

## Option Set

### Option A: Use Cosmograph/cosmos.gl as the engine

**Pros**

- Proven WebGL graph baseline.
- Good reference for GPU simulation/rendering.
- Useful benchmark competitor.

**Cons**

- We have already moved past its renderer architecture.
- It is not the right control plane for custom WebGPU culling, frame graph scheduling, perceptual LOD, and custom workflow interactions.
- Keeping it as the product engine would constrain the exact places where Kajillion needs to differentiate.

**Recommendation**

Use it as a benchmark and idea source, not as the core runtime.

### Option B: Use Sigma + Graphology as the engine

**Pros**

- Clean split between graph data and renderer.
- Graphology has useful algorithms, events, import/export, metrics, and traversal tools.
- Good reference for interaction and reducer-style visual state.

**Cons**

- Sigma is WebGL, not our WebGPU runtime.
- Graphology is object-oriented enough that it should not be the render-time store for 50k-1M entities.

**Recommendation**

Use Graphology-style APIs and possibly Graphology in workers/tests/import/export. Do not make it the hot graph store.

Source: https://www.sigmajs.org/docs/advanced/data/

### Option C: Use Cytoscape.js as the engine

**Pros**

- Strong high-level graph API.
- Good selectors, compound nodes, layouts, traversal, and app ergonomics.

**Cons**

- Too integrated and too high-level for Kajillion's high-scale WebGPU renderer.
- Better for rich graph app construction than for pushing our custom renderer to the limit.

**Recommendation**

Study its selector/layout/workflow ideas. Do not use it as the rendering engine.

Source: https://js.cytoscape.org/

### Option D: Use deck.gl/luma.gl style layers as the engine

**Pros**

- deck.gl has a mature mental model for layer lifecycle, attributes, invalidation, update triggers, and picking.
- luma.gl is already relevant in the current stack.

**Cons**

- deck.gl itself is not the right graph engine.
- Generic layer abstraction can become too expensive if it touches per-node/per-edge logic.

**Recommendation**

Copy the attribute/lifecycle ideas. Keep Kajillion's renderer custom and stricter.

Source: https://deck.gl/docs/developer-guide/custom-layers/attribute-management

### Option E: Use React Flow / Rete / LiteGraph as the engine

**Pros**

- Good visual authoring UI patterns.
- Useful if we later build a visual rule/workflow editor.

**Cons**

- These are editor/runtime systems for node-based UIs, not large graph renderers.
- They should not own graph rendering, interaction, or per-frame semantics.

**Recommendation**

Use them only for optional authoring/admin tools. The exported artifact should be Kajillion's own `GraphSpec` / `RuleSpec` JSON.

Sources:

- https://reactflow.dev/learn/advanced-use/performance
- https://retejs.org/docs/concepts/editor/

### Option F: Build our own Graph Scene Engine

**Pros**

- Best path to custom WebGPU performance.
- Gives us room for perceptual LOD, tile/bin culling, exact visible lists, custom labels, custom camera behavior, and product-specific workflows.
- Lets API flexibility compile into GPU-friendly buffers.

**Cons**

- More engineering responsibility.
- Requires discipline around module boundaries and benchmarks.

**Recommendation**

This is the path.

## Core Modules To Build

### 1. GraphStore

Owns canonical and visible graph data.

```txt
node columns:
  id, type, cluster, score, x, y, vx, vy, radius, color, flags

edge columns:
  source, target, type, weight, color, width, flags

indexes:
  id map, CSR/CSC adjacency, cluster index, visible set, active masks
```

Use Graphology-like ergonomics at the API boundary, but internally keep columns and typed arrays.

### 2. SceneCompiler

Turns flexible user rules into fixed render buffers.

Example public rule:

```ts
engine.addRule({
  where: { type: "person", score: { gt: 80 } },
  apply: {
    nodeColor: "gold",
    nodeSize: ["scale", "score", 3, 12],
    labelPriority: 0.9,
    selectable: true
  }
});
```

Compiled output:

```txt
nodeColorBuffer
nodeSizeBuffer
nodeOpacityBuffer
nodeGlyphBuffer
edgeColorBuffer
edgeOpacityBuffer
labelCandidateBuffer
interactionFlags
```

Use JsonLogic-like syntax for safe authoring, but compile it. Do not interpret JsonLogic per node per frame.

Source: https://jsonlogic.com/operations.html

### 3. Layer System

A layer is a GPU/resource contract, not a React component.

```txt
Layer:
  source: nodes | edges | labels | clusters | overlays
  filter: compiled predicate or visible set
  attributes: typed columns
  material: shader/pipeline family
  passes: compute/render pass declarations
  picking: optional picking behavior
```

### 4. Resource/Frame Graph

Use a lightweight frame graph to prevent the renderer from becoming a pile of flags.

```txt
Pass: upload dirty ranges
Pass: cull/LOD visible points
Pass: cull/LOD visible edges
Pass: tile/bin impostors
Pass: draw edges
Pass: draw nodes
Pass: draw labels
Pass: picking
Pass: bloom/composite/debug
```

Each pass declares what it reads and writes. Disabled passes should be pruned.

Source: https://google.github.io/filament/notes/framegraph.html

### 5. Interaction Controller

Own camera, pointer, zoom, drag, select, focus, pin, expand, and settle behavior.

D3 can remain a temporary adapter for pan/zoom mechanics, but not the long-term interaction engine.

Required states:

```txt
hovered
selected
focused
pinned
expanded
hidden
greyed
active
```

These states should compile to buffers/masks, not ad hoc render branches.

### 6. Workflow Engine

The graph product should not start by dumping the whole graph. The durable workflow is:

```txt
search/seed
  -> bounded workspace
  -> expand selectively
  -> inspect side panel
  -> filter/pathfind/group
  -> save/share
```

This follows the large-graph idea of search, context, and expand-on-demand.

Source: https://perer.org/papers/adamPerer-DOIGraphs-InfoVis2009.pdf

## Beauty Strategy

Kajillion needs multiple visual representations, not one shader with color presets.

### Far Zoom

- density fields
- aggregate glow
- cluster contours
- edge haze
- representative points
- very few labels

### Mid Zoom

- stable sampled real nodes
- bundled/sampled edges
- community labels
- important hubs
- no wallpaper blobs unless they represent real aggregate data

### Near Zoom

- exact high-quality nodes
- crisp anti-aliased edges
- labels with collision/priority
- hover/selection halos
- side-panel evidence

### Focus View

- selected node/path/neighborhood
- local exact topology
- non-focus context dimmed or aggregated
- no mysterious dimming side effects on click

The intended illusion is not "we loaded more nodes." It is "the graph is sharpening as I focus."

Source for aggregate-first large-data rendering philosophy: https://datashader.org/getting_started/Pipeline.html

## Culling/LOD Roadmap

### Current State

Kajillion already has true WebGPU draw-count culling:

- point compute cull writes visible point ids and indirect draw args
- line compute cull writes visible line ids and indirect draw args
- exact draws use `drawIndirect`

This is real culling, but it still scans the full point/edge population in compute.

### Round Completed Now

Point culling no longer recomputes the full visibility predicate twice.

Before:

```txt
count pass: evaluate point visibility
prefix pass: build offsets/count
scatter pass: evaluate point visibility again, write visible ids
drawIndirect
```

Now:

```txt
count pass: evaluate point visibility once, write visible mask
prefix pass: build offsets/count
scatter pass: reuse visible mask, write visible ids
drawIndirect
```

This preserves stable point order while reducing duplicate projection/LOD/size work.

### Next Culling Steps

1. **Parallel prefix for point visible groups**
   Replace the single-invocation prefix loop with a parallel scan when group count is large.

2. **World/bin coarse culling**
   Build static or slowly updated world bins. Skip whole bins before exact point tests.

3. **Edge culling from visible endpoint/bin data**
   Avoid scanning every edge when both endpoint regions are known invisible.

4. **Tile/bin picking reuse**
   Reuse visible/tile bins for hover and selection so pointer movement does not trigger broad scans.

5. **Culling instrumentation**
   Report total entities, scanned entities, visible entities, drawn entities, skipped bins, and cull pass ms.

## Product Workflow Rules

1. Click selects.
2. Double click or explicit command focuses.
3. Expansion is explicit.
4. High-degree node expansion first shows counts by type/direction.
5. Auto-fit only on first load, explicit fit, or opening a saved view.
6. Labels are earned by zoom, rank, hover, selection, or pinning.
7. Every cap is visible: "50 shown, 1,284 hidden."
8. Camera should settle at resting spots and then stop.
9. Layout changes should preserve the selected node's screen position when possible.
10. The canvas shows topology; the side panel shows evidence and properties.

## Decisions To Be Made

1. **Renderer split**
   Should vast overview and work graph be separate renderer modes sharing one scene contract, or one renderer with very different passes?

   Recommendation: separate modes, shared `GraphStore`/`SceneSpec`.

2. **GraphStore boundary**
   Should Graphology be used inside the client runtime or only in workers/tests/import/export?

   Recommendation: workers/tests/import/export only for high-scale paths.

3. **Rule authoring**
   Do we need visual rules soon, or only JSON/API rules first?

   Recommendation: JSON/API first. Visual editor later.

4. **Camera/input**
   Keep D3 interaction plumbing temporarily or replace now?

   Recommendation: replace after the current culling/visual stabilization pass. It is important but less urgent than getting render cost bounded.

5. **Layout**
   Should force layout be the default?

   Recommendation: no. Use force layout for exploratory views. Use bounded, semantic, or hierarchical layouts for work views.

6. **1M mode**
   Should 1M raw nodes be a normal interactive work state?

   Recommendation: no. It should be an overview/perceptual state with selective exact detail.

## Summary

Build Kajillion as a custom WebGPU graph scene engine.

Borrow concepts from deck.gl, Filament, Sigma/Graphology, Cytoscape, JsonLogic, Datashader, and graph workflow products, but do not hand them the hot path.

The durable architecture is:

```txt
expressive API
  -> compiled scene
  -> typed buffers
  -> explicit culling/LOD
  -> indirect WebGPU draws
  -> owned interaction workflow
```

The immediate engineering priority is to keep reducing render cost in ways that remain valuable no matter what visual style wins: culling, visible lists, tile/bin indexes, stable labels, and a clean camera/workflow controller.
