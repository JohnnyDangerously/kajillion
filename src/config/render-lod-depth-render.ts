export type RenderLodMode = 'exact' | 'phantom' | 'impostor' | 'auto'

export interface RenderLodRenderConfig {
  /**
   * Color-blend mode for link rendering.
   *
   * - `'normal'` (default): standard alpha blending. Each link is composited over the
   *   background using its own alpha. Behaves like upstream cosmos.gl.
   * - `'add'`: additive blending. Overlapping link fragments accumulate in brightness,
   *   producing a density-field-style visualization at galaxy zoom — communities and
   *   high-degree nodes appear as visibly brighter regions. Best paired with a higher
   *   `linkMinPixelLength` (e.g. 0) so all the sub-pixel signal is preserved, and a
   *   low per-link alpha (e.g. `linkOpacity: 0.05`) so the accumulation doesn't saturate.
   *
   * This setting is applied at engine initialization. Changing it via `setConfig` will
   * not take effect until the line pipeline is recreated.
   *
   * Default value: `'add'`
   */
  linkBlendMode: 'normal' | 'add';
  /**
   * Hard-skip rendering of links whose on-screen length (in CSS pixels) falls below this threshold.
   * Unlike `linkVisibilityDistanceRange` which fades opacity, this discards the link's draw entirely,
   * saving fragment shader work. Useful at galaxy zoom where sub-pixel edges become invisible noise.
   *
   * Set to `0` to disable.
   *
   * Default value: `0.5`
   */
  linkMinPixelLength: number;
  /**
   * Hard-skip rendering of point sprites whose final on-screen size (in device pixels) falls below
   * this threshold. Sub-pixel sprites get rasterized to at most one fragment and contribute mostly
   * noise; skipping them reduces fragment cost at far zoom levels.
   *
   * Set to `0` to disable.
   *
   * Default value: `0.5`
   */
  pointMinPixelSize: number;
  /**
   * High-level render LOD strategy.
   *
   * - `'exact'`: draw the exact primitive renderer. Low-level point/link LOD
   *   strength uniforms are forced off, even if configured.
   * - `'phantom'`: use stable perceptual sampling plus alpha/size/width
   *   compensation in the exact primitive shaders.
   * - `'impostor'`: render points through a low-resolution density field and
   *   composite that field back to the canvas. This is intended for dense
   *   overview zooms where individual point identity is perceptually lost.
   * - `'auto'`: lets the engine choose the best available LOD strategy. Dense
   *   WebGPU datasets promote to impostors; smaller or non-WebGPU datasets
   *   use the exact/phantom primitive path.
   *
   * This is intentionally separate from the low-level point/link LOD tuning
   * fields so applications can switch strategies without coupling to shader
   * implementation details.
   *
   * Default value: `'exact'`
   */
  renderLodMode: RenderLodMode;
}

export const renderLodRenderDefaultConfigValues = {
  linkBlendMode: 'add',
  linkMinPixelLength: 0.5,
  pointMinPixelSize: 0.5,
  renderLodMode: 'exact',
} satisfies RenderLodRenderConfig
