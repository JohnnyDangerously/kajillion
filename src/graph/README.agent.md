# Graph Runtime Shell

Owns small contracts and helpers used by the public `Graph` entrypoint.

Keep this area thin:

- type contracts and pure tuning helpers are fine here
- device creation/validation and stateless CPU-side helper builders are fine here
- renderer modules, GPU resources, and shader pass behavior stay in `src/modules`
- public API behavior remains surfaced through `src/index.ts`

Verify changes with:

```sh
npm run build
```
