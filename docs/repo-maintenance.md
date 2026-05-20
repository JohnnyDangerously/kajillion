# Repo Maintenance

This repo has three non-style maintenance layers.

## Fast Gate

Run:

```sh
npm run verify:fast
```

This checks file size discipline, WGSL parse validity, TypeScript source
types, tree-sitter structural rules, and dependency boundaries.

## Architecture Graph

Run:

```sh
npm run arch:check
npm run arch:graph
npm run arch:report
```

`arch:check` uses `dependency-cruiser` as the TypeScript equivalent of a
Tach-style import boundary checker. Current circular/orphan debt is
baselined in `.dependency-cruiser-known-violations.json`; new unapproved
violations fail.

## Structural Search

Run:

```sh
npm run ast:scan
npm run ast:find -- -p 'device.createBuffer($$$ARGS)' src
```

`ast-grep` gives us tree-sitter based structural search without maintaining
raw tree-sitter parser code.

## Code Review Graph

Run:

```sh
npm run graph:code-review
npm run graph:code-review:status
```

This uses `code-review-graph==2.3.3` through `uv tool run`. The generated
`.code-review-graph/` database is local and gitignored.
