export interface RenderLodImpostorConfig {
  /**
   * Downscale factor for the point density impostor render target.
   * Higher values draw fewer composite pixels and look softer; lower values
   * preserve sharper local structure.
   *
   * Default value: `4`
   */
  impostorDensityScale: number;
  /**
   * Screen-space tile size, in device pixels, for the GPU tile-binning
   * impostor renderer. The renderer draws at most one impostor quad per tile.
   *
   * Default value: `7`
   */
  impostorTileSize: number;
  /**
   * Number of stable point-like micro splats rendered per occupied tile in the
   * tile-binning impostor renderer. Higher values improve perceived point
   * detail while keeping draw cost bounded by `tiles * impostorMicroSplats`.
   *
   * Default value: `6`
   */
  impostorMicroSplats: number;
  /**
   * Opacity multiplier for tile-binned impostor micro-splats. This should stay
   * lower than normal point opacity when an exact overlay is enabled; the tile
   * layer is density support, not the primary visual truth.
   *
   * Default value: `0.18`
   */
  impostorTileOpacity: number;
  /**
   * When enabled, `renderLodMode: 'impostor'` renders a stable sampled exact
   * point layer over the tile-binned impostor layer. This preserves real node
   * texture while the tile layer fills in dense regions.
   *
   * Default value: `true`
   */
  impostorExactOverlay: boolean;
  /**
   * Draws the exact overlay as a deterministic point-id sample instead of
   * compacting a small per-tile anchor set. This costs more vertex work, but
   * avoids dense-tile anchor churn when the scene is in motion.
   *
   * Default value: `false`
   */
  impostorStableOverlay: boolean;
  /**
   * Stable sampled fraction for the exact anchor layer drawn over tile
   * impostors. Lower values keep high-count views fast while preserving real
   * point texture.
   *
   * Default value: `0.18`
   */
  impostorExactOverlaySampleRate: number;
  /**
   * Point opacity multiplier for the exact anchor layer over tile impostors.
   *
   * Default value: `0.36`
   */
  impostorExactOverlayOpacity: number;
  /**
   * Point size multiplier for the exact anchor layer over tile impostors.
   *
   * Default value: `0.38`
   */
  impostorExactOverlaySizeScale: number;
  /**
   * Tiles at or below this point count are treated as sparse: their real points
   * are drawn in the exact anchor pass and the fake tile layer is suppressed.
   *
   * Default value: `5`
   */
  impostorSparseTileThreshold: number;
  /**
   * Opacity multiplier for exact anchors in sparse tiles.
   *
   * Default value: `0.78`
   */
  impostorSparseAnchorOpacity: number;
  /**
   * Maximum compacted exact anchors stored per tile. Sparse tiles draw up to
   * this many real points; dense tiles use it as a hard cap for sampled anchors.
   *
   * Default value: `5`
   */
  impostorAnchorsPerTile: number;
  /**
   * Multiplier applied to point splat size in the density impostor pass.
   * Values above 1 make dense regions read as coherent glow fields instead of
   * isolated pinpricks.
   *
   * Default value: `1.6`
   */
  impostorPointSizeScale: number;
  /**
   * Tone-mapping strength for compositing the density impostor texture.
   *
   * Default value: `1.1`
   */
  impostorCompositeStrength: number;
  /**
   * Radius multiplier for the screen-space aggregate mass splats emitted by
   * the tile impostor renderer. This is the deck.gl-style `radiusPixels`
   * control for Kajillion's custom WebGPU density layer.
   *
   * Default value: `1`
   */
  impostorMassRadiusScale: number;
  /**
   * Normalized density threshold below which a tile contributes no aggregate
   * mass. This behaves like a heatmap low-density cutoff and prevents faint
   * full-screen fog in sparse regions.
   *
   * Default value: `0.08`
   */
  impostorMassThreshold: number;
  /**
   * Per-splat alpha ceiling for the aggregate mass layer. This is the bloom/
   * brightness budget that prevents dense tiles from washing to white.
   *
   * Default value: `0.08`
   */
  impostorMassMaxAlpha: number;
  /**
   * Color/luminance boost applied to the aggregate mass layer before alpha is
   * applied. Values above `1` make the density field more luminous without
   * making it more opaque.
   *
   * Default value: `1`
   */
  impostorMassColorBoost: number;
  /**
   * Optional pseudo-extrusion in screen space for aggregate mass. This should
   * remain `0` for normal graph interaction and can be raised by analytical or
   * gallery modes to show density intensity as terrain.
   *
   * Default value: `0`
   */
  impostorMassExtrusion: number;
  /**
   * Minimum point count where `renderLodMode: 'auto'` switches from primitive
   * rendering to the density impostor renderer.
   *
   * Default value: `75000`
   */
  impostorAutoMinPoints: number;
  /**
   * Maximum zoom level where `renderLodMode: 'auto'` may use point impostors.
   * Above this zoom, the renderer promotes back to exact point sprites so
   * close inspection shows real selectable nodes instead of aggregate dust.
   *
   * Default value: `0.28`
   */
  impostorAutoMaxZoom: number;
}

export const renderLodImpostorDefaultConfigValues = {
  impostorDensityScale: 4,
  impostorTileSize: 7,
  impostorMicroSplats: 1,
  impostorTileOpacity: 0.006,
  impostorExactOverlay: true,
  impostorStableOverlay: false,
  impostorExactOverlaySampleRate: 0.38,
  impostorExactOverlayOpacity: 0.74,
  impostorExactOverlaySizeScale: 0.86,
  impostorSparseTileThreshold: 5,
  impostorSparseAnchorOpacity: 0.95,
  impostorAnchorsPerTile: 6,
  impostorPointSizeScale: 1,
  impostorCompositeStrength: 0.24,
  impostorMassRadiusScale: 1,
  impostorMassThreshold: 0.08,
  impostorMassMaxAlpha: 0.08,
  impostorMassColorBoost: 1,
  impostorMassExtrusion: 0,
  impostorAutoMinPoints: 500000,
  impostorAutoMaxZoom: 0.28,
} satisfies RenderLodImpostorConfig
