# features/work-mode

Purpose:
- Own Work Mode product contracts and policy for zoomed-in local graph workflows.
- Keep Work Mode decisions separate from the macro galaxy/mega renderer path.

Current inventory:
- Demo controls live in `features/control-plane`; `DemoConfig.dataMode === "work"` is the explicit work dataset.
- Work graph data and metadata live in `features/demo-lifecycle/work-graph-*`.
- Local focus, preview, fit, and node-hopping behavior currently lives in `features/work-focus`.
- Work panel text projection lives in `features/ui-state/work-focus-panel`.
- Work Mode `GraphConfig` overlay policy lives here; generic demo config delegates Work Mode interaction/render knobs into this feature.
- Keep hot render loops in `src/graph` and `src/modules`.
- Use this feature's `index.ts` as the public Work Mode surface for policy, data helpers, controller access, and work graph types.

Boundaries:
- Add Work Mode product constants and contracts here first, then wire controllers to them.
- Runtime code may use thin wrappers here while implementation remains in existing lifecycle/focus modules.
- Do not add per-frame DOM or React loops for graph primitives.
- Do not add broad dependencies or object-heavy hot paths.
- UI controls must be truthful: node-count buttons should not silently switch
  data mode, and labels/readouts should describe the active render policy.
- Filtering sidebars, force-layout choices, node hopping, and A-to-B camera animations should grow under this feature before touching galaxy code.

Verify:
- `npm run verify:fast`
