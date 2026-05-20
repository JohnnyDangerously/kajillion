# features/demo-shell

Purpose:
- Own the static demo HTML shell styling that used to live inline in
  `demo/index.html`.

Important files:
- `demo-shell.css`: app shell, sidebar, overlay, gallery, and node-lab styles.

Invariants:
- DOM IDs/classes must stay compatible with `demo/src/main.ts` and feature
  control-plane lookups.
- This island should not import renderer or graph data code.
- Keep `demo/index.html` as structural markup plus script/style entrypoints.

Verify:
- `npm run demo:build`
