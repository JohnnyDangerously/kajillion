# Demo Graph Config

Owns the demo-only conversion from URL/control state into `GraphConfig`.

Keep this feature separate from graph data generation and render-loop lifecycle:
it is a policy layer that decides visual/render knobs, not a GPU hot path.

Verify changes with:

```sh
npm run demo:build
```
