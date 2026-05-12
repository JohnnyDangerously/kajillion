# luma.gl 9.2.6 upstream issues — kajillion repro drafts

These are reproductions of four real bugs found while porting `cosmos.gl` to
WebGPU under the `kajillion` fork. Each ships as a `patch-package` patch in
`patches/` so kajillion is unblocked, but they should be filed upstream at
`https://github.com/visgl/luma.gl/issues` so the patches can be retired.

## 1. `bufferLayout[i].stepMode` silently dropped (60× perf at scale)

**Severity:** critical (silent perf collapse, not validation failure).

**File:** `@luma.gl/webgpu/src/adapter/helpers/get-vertex-buffer-layout.ts`,
both interleaved and non-interleaved branches.

**Symptom:** A `Model` declared with `bufferLayout: [{ name: 'foo', format:
'float32x2', stepMode: 'instance' }]` builds a `GPURenderPipeline` with
`stepMode: 'vertex'` for that buffer slot — _unless_ the attribute name
starts with the literal string `"instance"`. The user's `stepMode` config
is ignored.

**Root cause:** the helper reads stepMode from the shader-layout reflection
(always undefined — `wgsl_reflect` doesn't carry stepMode), then falls
through to a name-prefix heuristic `attribute.name.startsWith('instance')
? 'instance' : 'vertex'`. The `mapping.stepMode` field of the user's
`bufferLayout` entry is never consulted.

**Impact in the wild:** kajillion's per-instance attributes are named
`pointIndices`, `size`, `color`, `shape`, `imageIndex`, `imageSize` — none
starts with "instance" — so every per-instance buffer was silently
configured as `stepMode: 'vertex'`. With `draw(4, N)` the GPU then ran 4N
per-vertex fetches reading buffers sized for N entries (out-of-bounds
reads). On Apple M5 Max + Chrome 148, this turned a draw that should take
1.3ms (verified via a no-luma raw-WebGPU reproduction) into a 555ms draw —
**~425× slower**. See [`benchmarks/raw-webgpu-100k.html`](../benchmarks/raw-webgpu-100k.html)
for the apples-to-apples raw-WebGPU baseline that drove the diagnosis.

**Fix (patches/@luma.gl+webgpu+9.2.6.patch):** prepend `mapping.stepMode ||`
to the existing fallback chain in both branches. Backwards-compatible —
when stepMode isn't supplied, the existing heuristic still applies.

```ts
// Was:
stepMode = attributeLayout?.stepMode ||
    (attributeLayout?.name.startsWith('instance') ? 'instance' : 'vertex');
// Now:
stepMode = mapping.stepMode ||
    attributeLayout?.stepMode ||
    (attributeLayout?.name.startsWith('instance') ? 'instance' : 'vertex');
```

**Test:** any Model with `bufferLayout` entries that explicitly set
`stepMode: 'instance'` and attribute names not starting with "instance".
Inspect the resulting `GPURenderPipelineDescriptor.vertex.buffers[i].stepMode`.

---

## 2. `WebGPURenderPipeline` single-slot bind-group cache thrashes (60-1200ms wasted/frame)

**Severity:** high (perf, multiplies with active passes per frame).

**File:** `@luma.gl/webgpu/src/adapter/resources/webgpu-render-pipeline.ts`,
`_getBindGroup()` method.

**Symptom:** every call to `setBindings({...})` with any changed binding
invalidates the single-slot `_bindGroup` cache. The next draw rebuilds the
GPUBindGroup from scratch via `getBindGroup()`. The source has a literal
TODO: `// TODO what if bindings change? We need to rebuild the bind group!`

**Impact in the wild:** kajillion's Barnes-Hut force pass loops 14 levels
per frame, calling `setBindings({ positionsTexture, levelFbo: target.texture })`
each iteration. Each iteration's `levelFbo` differs, so the cache invalidates
14× per frame → 14 createBindGroup calls per frame just for that one Model
× position-texture ping-pong → ~28 unique bind groups bouncing.

**Fix (patches/@luma.gl+webgpu+9.2.6.patch):** keyed cache by
binding-value-identity tuple. Nested Map keyed by each binding's reference
gives O(k) lookup with strict `===` semantics. Bounded LRU at the root
level (cap 32). Same fix applied to `WebGPUComputePipeline`.

Roughly:

```ts
private _bindGroupCache = new Map();
private static _BIND_GROUP_CACHE_LIMIT = 32;

_getBindGroup() {
  const layoutBindings = this.shaderLayout.bindings;
  if (layoutBindings.length === 0) return null;
  this._bindGroupLayout = this._bindGroupLayout || this.handle.getBindGroupLayout(0);
  const parts = layoutBindings.map(b => this._bindings[b.name]);
  let node = this._bindGroupCache;
  for (let i = 0; i < parts.length - 1; i++) {
    let next = node.get(parts[i]);
    if (!next) { next = new Map(); node.set(parts[i], next); }
    node = next;
  }
  const leafKey = parts[parts.length - 1];
  let group = node.get(leafKey);
  if (!group) {
    group = getBindGroup(this.device.handle, this._bindGroupLayout, this.shaderLayout, this._bindings);
    node.set(leafKey, group);
    if (this._bindGroupCache.size > /* limit */) {
      this._bindGroupCache.delete(this._bindGroupCache.keys().next().value);
    }
  }
  this._bindGroup = group;
  return group;
}

setBindings(bindings) {
  // No invalidation — the keyed cache picks the right group on _getBindGroup.
  Object.assign(this._bindings, bindings);
}
```

**Test:** any draw loop that calls `setBindings(...)` with two or more
distinct binding tuples across frames. Count `createBindGroup` calls via
Chrome's WebGPU tracing — should drop to 1 per unique tuple after warmup.

---

## 3. WGSL `var<storage>` bindings dropped from shader layout (pipeline creation fails)

**Severity:** critical (blocks any WGSL with storage bindings).

**File:** `@luma.gl/shadertools/src/lib/wgsl/get-shader-layout-wgsl.ts`,
`getShaderLayoutFromWGSL()`.

**Symptom:** `WgslReflect.storage[]` is never iterated. Any
`var<storage, read>` or `var<storage, read_write>` binding in a WGSL
source produces no entry in the extracted `ShaderLayout.bindings[]`.
Downstream this causes `createPipelineLayout()` to omit the binding —
when `createRenderPipeline` is then called with the auto-derived
`GPUBindGroupLayout`, validation fails: _"Binding doesn't exist in
[BindGroupLayoutInternal]"_.

**Secondary symptom:** even if storage is added by the consumer's
wrapper, the access mode (`read` vs `read_write`) is not propagated.
A read-only storage buffer is labeled `'storage'` (read-write) by
luma's pipeline-layout helper, and Dawn rejects read_write storage
buffers visible from the Vertex shader stage: _"Read-write storage
buffer binding is used with a visibility that contains ShaderStage::Vertex
(note that read-only storage buffer bindings are allowed)."_

**Fix (patches/@luma.gl+shadertools+9.2.6.patch):** add a loop over
`parsedWGSL.storage` that pushes each entry to `shaderLayout.bindings`
with `type: storage.access === 'read' ? 'read-only-storage' : 'storage'`.

```ts
for (const storage of parsedWGSL.storage || []) {
  const isReadOnly = storage.access === 'read';
  shaderLayout.bindings.push({
    type: isReadOnly ? 'read-only-storage' : 'storage',
    name: storage.name,
    group: storage.group,
    location: storage.binding,
  });
}
```

**Test:** any WGSL with `@group(0) @binding(N) var<storage, read>
positions: array<vec4<f32>>` used as a vertex-stage binding. Pre-fix:
pipeline-creation validation error. Post-fix: clean compile.

---

## 4. `props.timestampQuerySet` misrouted to `occlusionQuerySet`

**Severity:** critical for anyone using WebGPU timestamp queries.

**File:** `@luma.gl/webgpu/src/adapter/resources/webgpu-render-pass.ts`,
the WebGPURenderPass constructor.

**Symptom:** the code reads `props.timestampQuerySet` and assigns its
`.handle` to `renderPassDescriptor.occlusionQuerySet`, then separately
populates `renderPassDescriptor.timestampWrites` from the same prop.
The occlusionQuerySet path fails validation because the supplied QuerySet
is of type `'timestamp'`, not `'occlusion'`: _"The occlusionQuerySet
[QuerySet '...'] type (QueryType::Timestamp) is not QueryType::Occlusion."_
The render pass then fails to encode, the canvas stays empty, and
unsuspecting users see "60fps but nothing rendered" because rAF still
ticks against a blank canvas.

**Fix (patches/@luma.gl+webgpu+9.2.6.patch):** delete the
occlusionQuerySet assignment entirely (the timestampWrites assignment
downstream handles the timestamp case correctly). If the consumer
genuinely needs occlusion queries, they should pass a separate
`occlusionQuerySet` prop — which currently doesn't exist in
`RenderPassProps` either, so this path was dead code.

```ts
// Was:
const webgpuQuerySet = props.timestampQuerySet;
if (webgpuQuerySet) {
  renderPassDescriptor.occlusionQuerySet = webgpuQuerySet.handle;  // BUG
}
if (device.features.has('timestamp-query')) {
  /* ...timestampWrites = ... correct... */
}

// Now: just the timestampWrites block.
```

**Test:** any WebGPU device with `timestamp-query` feature, any code that
passes `timestampQuerySet` to `beginRenderPass`. Pre-fix: validation error
+ silent render-pass failures. Post-fix: clean.

---

## Filing checklist

For each issue:

1. Open at https://github.com/visgl/luma.gl/issues/new
2. Title: short, specific (e.g. _"WebGPU: bufferLayout[i].stepMode silently
   dropped, causes ~425× perf collapse"_).
3. Body: paste the relevant section above + reference the patch in
   `patches/@luma.gl+(package)+9.2.6.patch` for the exact diff.
4. Repro link: kajillion `benchmarks/raw-webgpu-100k.html` (no-luma baseline)
   + the affected Model construction site.

Bug #1 and #4 are unambiguous regressions worth fixing immediately. Bug #2
is a documented TODO and a real perf cost. Bug #3 blocks vertex-pulling
patterns that the WebGPU best-practice docs explicitly recommend (Toji,
Brandon Jones), so it'll hit any non-trivial WebGPU app sooner or later.
