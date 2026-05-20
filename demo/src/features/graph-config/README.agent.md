# Demo Graph Config

Owns the demo-only conversion from URL/control state into `GraphConfig`.

Keep this feature separate from graph data generation and render-loop lifecycle:
it is a policy layer that decides visual/render knobs, not a GPU hot path.

Work Mode-specific interaction/render policy belongs in `features/work-mode`;
delegate there instead of adding new Work Mode branches here.

Verify changes with:

```sh
npm run demo:build
```
