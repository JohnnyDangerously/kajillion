# Agent Navigation Tools

Kajillion keeps generated agent context out of the hot renderer. The local agent
map is a read-only navigation aid: it helps agents find ownership, symbols,
imports, and precise line ranges before editing.

## Commands

```sh
npm run agent:map
npm run agent:symbols -- src/modules/Points/index.ts
npm run agent:range -- src/modules/Points/index.ts 900 1120
npm run agent:owners -- visible-culling
npm run agent:find -- prepareGpu
```

`agent:map` writes `.agent-map/repo.json` and per-file symbol summaries under
`.agent-map/symbols/`. The directory is ignored by git.

## Intended Workflow

1. Run `npm run agent:map` after a large refactor or before handing work to
   another agent.
2. Use `npm run agent:owners -- <topic>` to find the feature island and verify
   command that owns the change.
3. Use `npm run agent:symbols -- <file>` instead of reading a large file whole.
4. Use `npm run agent:range -- <file> <start> <end>` to inspect only the target
   function or local block.
5. Use `npm run agent:find -- <symbol-or-topic>` when the file is not yet known.

## Scope

This is intentionally lighter than a full semantic index. It uses the TypeScript
compiler API for TS/JS symbol outlines and normal filesystem scanning for
feature contracts. For type-aware definition/reference work, use the editor LSP
or `tsserver`; for broad architecture boundaries, use the feature contracts and
import map first.
