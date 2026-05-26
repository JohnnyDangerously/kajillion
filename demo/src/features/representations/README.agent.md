# Graph Representations

This feature owns independent visual treatments for the demo graph. A
representation is selected with `?rep=<id>`. If `rep` is absent, the demo uses
the `work-graph` representation, which wraps the native work-graph path without
changing behavior.

## Island Model

Representations are islands. Each island is allowed to look, move, and load
assets differently, but it must do that through the shared `RepresentationPreset`
contract instead of leaking one experiment's assumptions into another.

Use this vocabulary when discussing visual branches:

- **Representation island**: a selectable graph view under
  `experiments/<id>/`, routed with `?rep=<id>`.
- **Native baseline**: `work-graph`, the product/work-mode graph. This is the
  default and should stay behavior-compatible with existing URLs.
- **Visual experiment**: a representation that owns its own layout, styling,
  overlay, asset loading, or camera behavior.
- **Compatibility alias**: a registered id that intentionally routes to another
  implementation so old URLs do not break.
- **Sandbox/lab**: adjacent tooling such as `node-treatment-lab` or
  `gallery-presets`; useful for visual exploration, but not a representation
  until it is registered here.

The point of the island model is de-risking: an agent can build or delete a
visual direction without corrupting the native graph or other experiments.
When a visual branch fails, leave the island intact for reference or retire it
locally; do not scatter partial fixes through demo runtime or core WebGPU code.

## Boundary

Keep representation experiments self-contained:

- `registry.ts` is the only public switchboard.
- `types.ts` defines the shared preset contract.
- `experiments/<id>/preset.ts` owns the GraphConfig overlay and install hook.
- `experiments/<id>/layout.ts` owns representation-specific coordinates.
- `experiments/<id>/style.ts` owns representation-specific visual attributes.
- `experiments/<id>/overlay*.ts` may own DOM/canvas overlays for that preset.
- Asset loaders stay beside the preset that consumes them.

Do not add experiment-only behavior to the core graph runtime. Promote shared
code only after two representations need the same primitive and the primitive is
stable.

## Current Views

- `work-graph`, also used when no `rep` is present: the product/work-mode
  baseline. This is the clustered exact graph shown by default for `data=work`.
  It intentionally has no preset hooks, so native work-mode behavior remains in
  the existing work-mode/demo-lifecycle/ui-state modules.
- `atlas-reference`: currently a compatibility alias for `reference-cloud`.
  The earlier 2D atlas overlay is disabled so this URL stays on the 3D
  graph-cloud direction instead of flat packed island rows.
- `reference-cloud`: a dense 2.5D cloud/reference view. It uses a canvas
  overlay with perspective projection, depth-sorted point sprites,
  satellite/tendril placement, and faint bridge tissue. This branch is
  experimental and should not be treated as the product visual baseline.
- `neon-glass`: a headshot/photo-wall experiment using `/headshots` atlas
  assets and bloom animation controls.
- `neon-network`: the larger people-image network. It loads
  `/network/john-2hop.bin`, `/network/atlas-128.webp`, and
  `/network/photo-manifest.json`, then routes those images through the GPU point
  image atlas path. Preserve this as the "real people images" representation.

Adjacent but not registered representations:

- `node-treatment-lab`: individual node/edge treatment sandbox.
- `gallery-presets`: legacy gallery preset system for palette/layout/style
  exploration.

## Adding A Representation

1. Create `experiments/<id>/`.
2. Add `index.ts`, `preset.ts`, and optional `layout.ts`, `style.ts`, loaders,
   overlays, or local helpers.
3. Export a `RepresentationPreset` with a stable `id`.
4. Register it in `registry.ts`.
5. Add a local `README.agent.md` describing the intent, assets, URL, and what
   not to merge into other views.

The preset hooks run in this order:

1. `applyGraphConfig`
2. `transformPositions`
3. `transformAttributes`
4. `install`

Use `ownsCamera: true` when the representation frames or animates the camera
itself. Keep `install` teardown complete; representation overlays and styles
must not leak into the next rebuild.

## QA

Use the focused checks before handing off representation work:

```sh
npm run typecheck
npm run check:source-size
```

Useful URLs on a local demo server:

```text
/?n=4000&data=work&theme=light&useWebGPU=1
/?n=4000&data=work&theme=light&useWebGPU=1&rep=work-graph
/?n=100000&data=work&theme=dark&useWebGPU=1&rep=atlas-reference
/?n=100000&data=work&theme=dark&useWebGPU=1&rep=reference-cloud
/?n=1005&data=work&theme=dark&useWebGPU=1&rep=neon-glass
/?n=19074&data=work&theme=dark&useWebGPU=1&rep=neon-network
```
