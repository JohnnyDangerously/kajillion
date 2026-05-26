# Work Graph Representation

This preset is the first-class representation island for the current native
work graph.

## URL

```text
/?n=4000&data=work&theme=light&useWebGPU=1
/?n=4000&data=work&theme=light&useWebGPU=1&rep=work-graph
```

Both URLs should behave the same. `work-graph` is also the default
representation when `rep` is absent.

## Boundary

This island intentionally wraps the existing product/work-mode path without
changing it. The native work graph still gets its behavior from:

- `demo/src/features/work-mode/`
- `demo/src/features/demo-lifecycle/work-graph-*`
- `demo/src/features/ui-state/visual-attributes/`
- normal demo runtime camera fitting and interaction wiring

Do not move or rewrite those systems here unless the goal is an explicit,
behavior-preserving extraction. Keep visual experiments separate from this
baseline.
