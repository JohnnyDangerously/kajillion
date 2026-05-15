/* eslint-disable @typescript-eslint/naming-convention */
import { D3ZoomEvent } from 'd3-zoom'
import { D3DragEvent } from 'd3-drag'
import { type Hovered } from '@/graph/modules/Store'
import { defaultConfigValues } from '@/graph/variables'
import { PointShape } from '@/graph/modules/GraphData'

export type RenderLodMode = 'exact' | 'phantom' | 'impostor' | 'auto'

export interface GraphConfigInterface {
  /**
   * If set to `false`, the simulation will not run.
   * This property will be applied only on component initialization and it
   * can't be changed using the `setConfig` or `setConfigPartial` methods.
   * Default value: `true`
   */
  enableSimulation: boolean;
  /**
   * Canvas background color.
   * Can be either a hex color string (e.g., '#b3b3b3') or an array of RGBA values.
   * Default value: '#222222'
   */
  backgroundColor: string | [number, number, number, number];
  /**
   * Simulation space size.
   * Default value: `4096` (larger values may crash on some devices, e.g. iOS; see https://github.com/cosmosgl/graph/issues/203).
   */
  spaceSize: number;

  /**
   * The default color to use for points when no point colors are provided,
   * or if the color value in the array is `undefined` or `null`.
   * This can be either a hex color string (e.g., '#b3b3b3') or an array of RGBA values
   * in the format `[red, green, blue, alpha]` where each value is a number between 0 and 1.
   * Default value: '#b3b3b3'
   */
  pointDefaultColor: string | [number, number, number, number];

  /**
   * The color to use for points when they are greyed out (when highlighting is active).
   * This can be either a hex color string (e.g., '#b3b3b3') or an array of RGBA values
   * in the format `[red, green, blue, alpha]` where each value is a number between 0 and 1.
   *
   * If not provided, the color will be the same as the point's original color,
   * but darkened or lightened depending on the background color.
   *
   * If `pointGreyoutOpacity` is also defined, it will be multiplied with the final alpha
   * of this color.
   *
   * Default value: `undefined`
   */
  pointGreyoutColor?: string | [number, number, number, number];

  /**
   * Opacity of greyed-out points when highlighting is active.
   * Range: 0 (fully transparent) to 1 (fully opaque).
   * When set, used instead of `pointOpacity` for greyed-out points.
   * Default value: `undefined`
   */
  pointGreyoutOpacity?: number;

  /**
   * The default size value to use for points when no point sizes are provided or
   * if the size value in the array is `undefined` or `null`.
   * Default value: `4`
  */
  pointDefaultSize: number;

  /**
   * The default shape to use for points when no point shapes are provided via `setPointShapes()`,
   * or if the shape value in the array is `undefined`, `null`, or invalid.
   * Accepts a `PointShape` enum value (e.g., `PointShape.Circle`), a plain number (e.g., `2`), or a numeric string (e.g., `"2"`).
   * Default value: `PointShape.Circle`
   */
  pointDefaultShape: PointShape | `${PointShape}`;

  /**
   * Universal opacity value applied to all points.
   * This value multiplies with individual point alpha values (if set via setPointColors).
   * Useful for dynamically controlling opacity of all points without updating individual RGBA arrays.
   * Default value: `1.0`
   */
  pointOpacity: number;

  /**
   * Scale factor for the point size.
   * Default value: `1`
   */
  pointSizeScale: number;

  /**
   * Cursor style to use when hovering over a point
   * Default value: `auto`
   */
  hoveredPointCursor: string;

  /**
   * Cursor style to use when hovering over a link
   * Default value: `auto`
   */
  hoveredLinkCursor: string;

  /**
   * Turns ring rendering around a point on hover on / off
   * Default value: `false`
   */
  renderHoveredPointRing: boolean;

  /**
   * Hovered point ring color hex value.
   * Can be either a hex color string (e.g., '#b3b3b3') or an array of RGBA values.
   * Default value: `white`
   */
  hoveredPointRingColor: string | [number, number, number, number];

  /**
   * Focused point ring color hex value.
   * Can be either a hex color string (e.g., '#b3b3b3') or an array of RGBA values.
   * Default value: `white`
   */
  focusedPointRingColor: string | [number, number, number, number];

  /**
   * Set focus on a point by index. A ring will be rendered around the focused point.
   * The focused ring is larger than outline rings to create a clear visual hierarchy.
   * When set to `undefined`, no point is focused.
   * Default value: `undefined`
   */
  focusedPointIndex?: number;

  /**
   * Array of point indices to highlight. When set, all points NOT in this array will be
   * greyed out. An empty array `[]` activates highlighting with all points greyed out.
   * Set to `undefined` to clear highlighting and show all points normally.
   * Default value: `undefined`
   */
  highlightedPointIndices?: number[];

  /**
   * Optional active point draw list for WebGPU interaction filtering. When set,
   * WebGPU culling/indirect draw paths draw only these point indices without
   * rebuilding point buffers. Set to `undefined` to draw all points.
   * Default value: `undefined`
   */
  activePointIndices?: number[];

  /**
   * Array of point indices to draw an outline ring around. The outline ring is a circle
   * rendered around the point regardless of the point's shape. When a point is both
   * outlined and greyed out (not highlighted), the ring color is dimmed to match.
   * Default value: `undefined`
   */
  outlinedPointIndices?: number[];

  /**
   * Color of the outline ring drawn around outlined points.
   * Can be either a hex color string (e.g., '#b3b3b3') or an array of RGBA values.
   * Default value: `'white'`
   */
  outlinedPointRingColor: string | [number, number, number, number];

  /**
   * Turns link rendering on / off.
   * Default value: `true`
   */
  renderLinks: boolean;

  /**
   * The default color to use for links when no link colors are provided,
   * or if the color value in the array is `undefined` or `null`.
   * This can be either a hex color string (e.g., '#666666') or an array of RGBA values
   * in the format `[red, green, blue, alpha]` where each value is a number between 0 and 1.
   * Default value: '#666666'
   */
  linkDefaultColor: string | [number, number, number, number];

  /**
   * Universal opacity value applied to all links.
   * This value multiplies with individual link alpha values (if set via setLinkColors).
   * Useful for dynamically controlling opacity of all links without updating individual RGBA arrays.
   * Default value: `1.0`
   */
  linkOpacity: number;

  /**
   * Greyed-out link opacity value when link highlighting is active.
   * Default value: `0.1`
  */
  linkGreyoutOpacity: number;

  /**
   * Array of link indices to highlight. When set, all links NOT in this array will be
   * greyed out. An empty array `[]` activates highlighting with all links greyed out.
   * Set to `undefined` to clear highlighting and show all links normally.
   * Link highlighting is independent of point highlighting.
   * Default value: `undefined`
   */
  highlightedLinkIndices?: number[];

  /**
   * Optional active link draw list for WebGPU interaction filtering. When set,
   * WebGPU culling/indirect draw paths draw only these link indices without
   * replacing topology via `setLinks()`. Set to `undefined` to draw all links.
   * Default value: `undefined`
   */
  activeLinkIndices?: number[];

  /**
   * Set focus on a link by index. The focused link will be rendered with extra width.
   * When set to `undefined`, no link is focused.
   * Default value: `undefined`
   */
  focusedLinkIndex?: number;

  /**
   * Number of pixels to add to the link width when focused.
   * The focused width is calculated as: originalWidth + focusedLinkWidthIncrease
   * Default value: `5`
   */
  focusedLinkWidthIncrease: number;
  /**
   * The default width value to use for links when no link widths are provided or if the width value in the array is `undefined` or `null`.
   * Default value: `1`
  */
  linkDefaultWidth: number;

  /**
   * The color to use for links when they are hovered.
   * This can be either a hex color string (e.g., '#ff3333') or an array of RGBA values
   * in the format `[red, green, blue, alpha]` where each value is a number between 0 and 1.
   * Default value: `undefined`
   */
  hoveredLinkColor?: string | [number, number, number, number];
  /**
   * Number of pixels to add to the link width when hovered.
   * The hovered width is calculated as: originalWidth + hoveredLinkWidthIncrease
   * Default value: `5`
   */
  hoveredLinkWidthIncrease: number;
  /**
   * Scale factor for the link width.
   * Default value: `1`
   */
  linkWidthScale: number;
  /**
   * Increase or decrease the size of the links when zooming in or out.
   * Default value: `false`
   */
  scaleLinksOnZoom: boolean;
  /**
   * If set to true, links are rendered as curved lines.
   * Otherwise as straight lines.
   * Default value: `false`
   */
  curvedLinks: boolean;
  /**
   * Number of segments in a curved line.
   * Default value: `19`.
   */
  curvedLinkSegments: number;
  /**
   * Weight affects the shape of the curve.
   * Default value: `0.8`.
   */
  curvedLinkWeight: number;
  /**
   * Defines the position of the control point of the curve on the normal from the centre of the line.
   * If set to 1 then the control point is at a distance equal to the length of the line.
   * Default value: `0.5`
   */
  curvedLinkControlPointDistance: number;
  /**
   * Gently pulls the middle of straight links toward shared screen/world-space lanes.
   *
   * This is a lightweight, single-pass visual decluttering mode: endpoints remain exact,
   * while intermediate vertices are nudged with a sine falloff so similar nearby links
   * read as soft corridors instead of fully merged KDE-style bundles.
   *
   * Set to `0` to disable.
   *
   * Default value: `0`
   */
  linkBundlingStrength: number;
  /**
   * World-space cell size used by `linkBundlingStrength` to pick soft lane anchors.
   * Larger values create broader, calmer lanes; smaller values keep edges closer to
   * their original straight paths.
   *
   * Default value: `320`
   */
  linkBundlingCellSize: number;
  /**
   * The default link arrow value that controls whether or not to display link arrows.
   * Default value: `false`
   */
  linkDefaultArrows: boolean;

  /**
   * Scale factor for the link arrows size.
   * Default value: `1`
   */
  linkArrowsSizeScale: number;
  /**
   * The range defines the minimum and maximum link visibility distance in pixels.
   * The link will be fully opaque when its length is less than the first number in the array,
   * and will have `linkVisibilityMinTransparency` transparency when its length is greater than
   * the second number in the array.
   * This distance is defined in screen space coordinates and will change as you zoom in and out
   * (e.g. links become longer when you zoom in, and shorter when you zoom out).
   * Default value: `[50, 150]`
   */
  linkVisibilityDistanceRange: number[];
  /**
   * The transparency value that the link will have when its length reaches
   * the maximum link distance value from `linkVisibilityDistanceRange`.
   * Default value: `0.25`
   */
  linkVisibilityMinTransparency: number;
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
  /**
   * Strength of perceptual point LOD. This uses stable hashed sampling plus
   * alpha/size compensation so dense regions preserve apparent density while
   * drawing fewer point sprites at far zoom.
   *
   * `0` disables point LOD. `1` applies the full configured sampling curve.
   *
   * Default value: `0`
   */
  pointLodStrength: number;
  /**
   * Camera-scale range controlling point LOD, expressed as
   * `[farScale, nearScale]`. At or below `farScale`, point sampling reaches
   * `pointLodMinSampleRate`; at or above `nearScale`, all points are drawn.
   * Between the two, the transition is smooth and stable.
   *
   * Default value: `[0.12, 0.65]`
   */
  pointLodZoomRange: number[];
  /**
   * Minimum fraction of point sprites drawn when point LOD is fully active.
   * The selected subset is stable and nested, so it does not reshuffle each frame.
   *
   * Default value: `0.45`
   */
  pointLodMinSampleRate: number;
  /**
   * Amount of sprite-size compensation applied to surviving point samples.
   * `0` keeps point size unchanged; `1` uses the full compensation curve.
   *
   * Default value: `0.55`
   */
  pointLodSizeCompensation: number;
  /**
   * Amount of opacity compensation applied to surviving point samples.
   * `0` keeps alpha unchanged; `1` uses the full compensation curve.
   *
   * Default value: `0.75`
   */
  pointLodOpacityCompensation: number;
  /**
   * Strength of perceptual link LOD. This uses stable hashed sampling plus
   * opacity/width compensation so the edge field reads as similarly dense
   * while reducing clutter and fragment work at overview zoom.
   *
   * `0` disables link LOD. `1` applies the full configured sampling curve.
   *
   * Default value: `0`
   */
  linkLodStrength: number;
  /**
   * Camera-scale range controlling link LOD, expressed as
   * `[farScale, nearScale]`. At or below `farScale`, link sampling reaches
   * `linkLodMinSampleRate`; at or above `nearScale`, all links are drawn.
   *
   * Default value: `[0.10, 0.60]`
   */
  linkLodZoomRange: number[];
  /**
   * Minimum fraction of links drawn when link LOD is fully active.
   *
   * Default value: `0.35`
   */
  linkLodMinSampleRate: number;
  /**
   * Amount of width compensation applied to surviving link samples.
   *
   * Default value: `0.35`
   */
  linkLodWidthCompensation: number;
  /**
   * Amount of opacity compensation applied to surviving link samples.
   *
   * Default value: `0.65`
   */
  linkLodOpacityCompensation: number;

  /**
   * Decay coefficient. Lower = the simulation cools down faster after each interaction.
   *
   * Settle time is wall-clock based: at the default 60 Hz reference frame rate, alpha decays
   * from 1 to `alphaStopThreshold` in approximately `decay × ln(stopThreshold) / ln(0.001)`
   * ticks (≈ 432 ticks ≈ 7.2 seconds at `decay=1000`, `alphaStopThreshold=0.05`). At lower actual
   * frame rates the per-tick decay is scaled up so the wall-clock settle time stays roughly
   * constant — a slow GPU does not prevent the simulation from settling.
   *
   * Default value: `1000`
   */
  simulationDecay: number;
  /**
   * Target rate (Hz) at which the physics simulation steps. Render continues to run
   * at the native rAF rate (typically 60 Hz or higher); physics ticks are throttled
   * to at most `physicsTickRate` per second. Between physics ticks, point positions
   * are held — the GPU re-renders the last computed positions each frame.
   *
   * `0` means "uncapped" (one physics tick per render frame; matches upstream behavior).
   *
   * Lowering this below the rAF rate (e.g. 30 instead of 60) approximately halves the
   * per-second cost of force passes and reduces GPU energy/power draw, but proportionally
   * lengthens settle time in wall-clock seconds (alpha decay is per-tick, not per-second)
   * and visually steps the layout animation at the chosen rate. Without render-side
   * position interpolation, the layout appears to update at the lower rate even though
   * render and camera move at full rAF rate. Useful for battery-powered devices, very
   * large graphs, or background tabs where energy and load matter more than animation
   * fluidity.
   *
   * Has no effect on user-triggered `step()` calls, which always execute regardless
   * of the throttle.
   *
   * Default value: `0`
   */
  physicsTickRate: number;
  /**
   * Maximum render-loop rate in frames per second.
   *
   * `0` means "native rAF": render once per `requestAnimationFrame` callback,
   * which lets high-refresh displays run above 60 Hz when the browser provides
   * higher-rate callbacks. Values above the display refresh rate cannot force
   * visible presentation faster than the browser/compositor, but they do avoid
   * imposing an artificial 60 Hz ceiling.
   *
   * Use a positive value to intentionally pace the whole render/simulation loop
   * below native refresh. This can reduce GPU load and improve 1% lows when the
   * scene is near saturation, but rAF-based pages can only present on vsync, so
   * targets very close to native refresh may effectively behave as native.
   *
   * Default value: `0`
   */
  frameRateLimit: number;
  /**
   * Optional refresh-aware render headroom in frames per second.
   *
   * Applied only when `frameRateLimit` is `0`. The engine estimates the display
   * refresh rate from rAF timestamps, snaps it to a common refresh bucket, and
   * targets `refreshHz - frameRateHeadroomFps`. For example, `3` on a 144 Hz
   * display targets roughly 141 fps.
   *
   * This is a soft browser cap, not exact native swapchain pacing. The engine
   * can only skip rAF callbacks, so very small headroom values may behave like
   * native cadence. It is disabled on 60 Hz and lower displays because tiny
   * under-caps there usually add jitter without useful headroom.
   *
   * Default value: `0`
   */
  frameRateHeadroomFps: number;
  /**
   * Enables an in-memory frame/input trace for diagnosing visual artifacts such
   * as pan/zoom flashes. When enabled, call `getDebugFrameTrace()` on the Graph
   * instance from the browser console to inspect the recent event ring buffer.
   *
   * Default value: `false`
   */
  debugFrameTrace: boolean;
  /**
   * Alpha threshold at which the simulation is considered "settled" and stops running force passes.
   * When `alpha` drops below this value, `onSimulationEnd` fires and the six force passes
   * (gravity, center, repulsion, link-incoming, link-outgoing, cluster) are skipped each frame
   * until the next interaction (drag, zoom, restart) reseeds alpha.
   *
   * Raising this value makes the graph settle visually sooner at the cost of slightly less
   * fine-grained layout convergence; lowering it (toward `0.001`) lets the simulation run
   * longer for higher-quality stationary layouts.
   *
   * Internally clamped to at least `0.001` to guarantee the simulation always terminates.
   *
   * Default value: `0.05`
   */
  alphaStopThreshold: number;
    /**
   * Gravity force coefficient.
   * Default value: `0.25`
   */
  simulationGravity: number;
  /**
   * Centering to center mass force coefficient.
   * Default value: `0`
   */
  simulationCenter: number;
  /**
   * Repulsion force coefficient.
   * Default value: `1.0`
   */
  simulationRepulsion: number;
  /**
   * Decreases / increases the detalization of the Many-Body force calculations.
   * Default value: `1.15`
   */
  simulationRepulsionTheta: number;
  /**
   * Link spring force coefficient.
   * Default value: `1`
   */
  simulationLinkSpring: number;
  /**
   * Minimum link distance.
   * Default value: `10`
   */
  simulationLinkDistance: number;
  /**
   * Range of random link distance values.
   * Default value: `[1, 1.2]`
   */
  simulationLinkDistRandomVariationRange: number[];
  /**
   * Repulsion coefficient from mouse position.
   * The repulsion force is activated by pressing the right mouse button.
   * Default value: `2`
   */
  simulationRepulsionFromMouse: number;
  /**
   * Enable or disable the repulsion force from mouse when right-clicking.
   * When set to `true`, holding the right mouse button will activate the mouse repulsion force.
   * When set to `false`, right-clicking will not trigger any repulsion force.
   * Default value: `false`
   */
  enableRightClickRepulsion: boolean;
  /**
   * Friction coefficient.
   * Values range from 0 (high friction, stops quickly) to 1 (no friction, keeps moving).
   * Default value: `0.85`
   */
  simulationFriction: number;
  /**
   * Cluster coefficient.
   * Default value: `0.1`
   */
  simulationCluster: number;

  /**
   * Callback function that will be called when the simulation starts.
   * Default value: `undefined`
   */
  onSimulationStart?: () => void;
  /**
   * Callback function that will be called on every simulation tick.
   * The value of the first argument `alpha` will decrease over time as the simulation "cools down".
   * If there's a point under the mouse pointer, its index will be passed as the second argument
   * and position as the third argument:
   * `(alpha: number, hoveredIndex: number | undefined, pointPosition: [number, number] | undefined) => void`.
   * Default value: `undefined`
   */
  onSimulationTick?: (
    alpha: number, hoveredIndex?: number, pointPosition?: [number, number]
    ) => void;
  /**
   * Callback function that will be called when the simulation stops.
   * Default value: `undefined`
   */
  onSimulationEnd?: () => void;
  /**
   * Callback function that will be called when the simulation gets paused.
   * Default value: `undefined`
   */
  onSimulationPause?: () => void;

  /**
   * Callback function that will be called when the simulation is unpaused.
   * Default value: `undefined`
   */
  onSimulationUnpause?: () => void;

  /**
   * Callback function that will be called on every canvas click.
   * If clicked on a point, its index will be passed as the first argument,
   * position as the second argument and the corresponding mouse event as the third argument:
   * `(index: number | undefined, pointPosition: [number, number] | undefined, event: MouseEvent) => void`.
   * Default value: `undefined`
   */
  onClick?: (
    index: number | undefined, pointPosition: [number, number] | undefined, event: MouseEvent
  ) => void;

  /**
   * Callback function that will be called when a point is clicked.
   * The point index will be passed as the first argument,
   * position as the second argument and the corresponding mouse event as the third argument:
   * `(index: number, pointPosition: [number, number], event: MouseEvent) => void`.
   * Default value: `undefined`
   */
  onPointClick?: (
    index: number,
    pointPosition: [number, number],
    event: MouseEvent
  ) => void;

  /**
   * Callback function that will be called when a link is clicked.
   * The link index will be passed as the first argument and the corresponding mouse event as the second argument:
   * `(linkIndex: number, event: MouseEvent) => void`.
   * Default value: `undefined`
   */
  onLinkClick?: (
    linkIndex: number,
    event: MouseEvent
  ) => void;

  /**
   * Callback function that will be called when the background (empty space) is clicked.
   * The mouse event will be passed as the first argument:
   * `(event: MouseEvent) => void`.
   * Default value: `undefined`
   */
  onBackgroundClick?: (
    event: MouseEvent
  ) => void;

  /**
   * Callback function that will be called when a context menu trigger (typically right click) happens on the canvas.
   * If triggered on a point, its index will be passed as the first argument,
   * position as the second argument and the corresponding mouse event as the third argument:
   * `(index: number | undefined, pointPosition: [number, number] | undefined, event: MouseEvent) => void`.
   * Default value: `undefined`
   */
  onContextMenu?: (
    index: number | undefined, pointPosition: [number, number] | undefined, event: MouseEvent
  ) => void;

  /**
   * Callback function that will be called when a context menu trigger (typically right click) happens on a point.
   * The point index will be passed as the first argument,
   * position as the second argument and the corresponding mouse event as the third argument:
   * `(index: number, pointPosition: [number, number], event: MouseEvent) => void`.
   * Default value: `undefined`
   */
  onPointContextMenu?: (
    index: number,
    pointPosition: [number, number],
    event: MouseEvent
  ) => void;

  /**
   * Callback function that will be called when a context menu trigger (typically right click) happens on a link.
   * The link index will be passed as the first argument and the corresponding mouse event as the second argument:
   * `(linkIndex: number, event: MouseEvent) => void`.
   * Default value: `undefined`
   */
  onLinkContextMenu?: (
    linkIndex: number,
    event: MouseEvent
  ) => void;

  /**
   * Callback function that will be called when a context menu trigger (typically right click) happens on the background (empty space).
   * The mouse event will be passed as the first argument:
   * `(event: MouseEvent) => void`.
   * Default value: `undefined`
   */
  onBackgroundContextMenu?: (
    event: MouseEvent
  ) => void;

  /**
   * Callback function that will be called when mouse movement happens.
   * If the mouse moves over a point, its index will be passed as the first argument,
   * position as the second argument and the corresponding mouse event as the third argument:
   * `(index: number | undefined, pointPosition: [number, number] | undefined, event: MouseEvent) => void`.
   * Default value: `undefined`
   */
  onMouseMove?: (
    index: number | undefined, pointPosition: [number, number] | undefined, event: MouseEvent
  ) => void;

  /**
   * Callback function that will be called when a point appears under the mouse
   * as a result of a mouse event, zooming and panning, or movement of points.
   * The point index will be passed as the first argument, position as the second argument,
   * the corresponding mouse event or D3's zoom event as the third argument,
   * whether the hovered point is highlighted as the fourth argument,
   * and whether the hovered point is outlined as the fifth argument:
   * `(index, pointPosition, event, isHighlighted, isOutlined) => void`.
   * Default value: `undefined`
   */
  onPointMouseOver?: (
    index: number,
    pointPosition: [number, number],
    event: MouseEvent | D3DragEvent<HTMLCanvasElement, undefined, Hovered> | D3ZoomEvent<HTMLCanvasElement, undefined> | undefined,
    isHighlighted: boolean,
    isOutlined: boolean
  ) => void;

  /**
   * Callback function that will be called when a point is no longer underneath
   * the mouse pointer because of a mouse event, zoom/pan event, or movement of points.
   * The corresponding mouse event or D3's zoom event will be passed as the first argument:
   * `(event: MouseEvent | D3ZoomEvent<HTMLCanvasElement, undefined> | D3DragEvent<HTMLCanvasElement, undefined, Hovered> | undefined) => void`.
   * Default value: `undefined`
   */
  onPointMouseOut?: (event: MouseEvent | D3ZoomEvent<HTMLCanvasElement, undefined> | D3DragEvent<HTMLCanvasElement, undefined, Hovered> | undefined) => void;

  /**
   * Callback function that will be called when the mouse moves over a link.
   * The link index will be passed as the first argument:
   * `(linkIndex: number) => void`.
   * Default value: `undefined`
   */
  onLinkMouseOver?: (linkIndex: number) => void;

  /**
   * Callback function that will be called when the mouse moves out of a link.
   * The event will be passed as the first argument:
   * `(event: MouseEvent | D3ZoomEvent<HTMLCanvasElement, undefined> | D3DragEvent<HTMLCanvasElement, undefined, Hovered> | undefined) => void`.
   * Default value: `undefined`
   */
  onLinkMouseOut?: (event: MouseEvent | D3ZoomEvent<HTMLCanvasElement, undefined> | D3DragEvent<HTMLCanvasElement, undefined, Hovered> | undefined) => void;

  /**
   * Callback function that will be called when zooming or panning starts.
   * First argument is a D3 Zoom Event and second indicates whether
   * the event has been initiated by a user interaction (e.g. a mouse event):
   * `(event: D3ZoomEvent, userDriven: boolean) => void`.
   * Default value: `undefined`
   */
  onZoomStart?: (e: D3ZoomEvent<HTMLCanvasElement, undefined>, userDriven: boolean) => void;

  /**
   * Callback function that will be called continuously during zooming or panning.
   * First argument is a D3 Zoom Event and second indicates whether
   * the event has been initiated by a user interaction (e.g. a mouse event):
   * `(event: D3ZoomEvent, userDriven: boolean) => void`.
   * Default value: `undefined`
   */
  onZoom?: (e: D3ZoomEvent<HTMLCanvasElement, undefined>, userDriven: boolean) => void;

  /**
   * Callback function that will be called when zooming or panning ends.
   * First argument is a D3 Zoom Event and second indicates whether
   * the event has been initiated by a user interaction (e.g. a mouse event):
   * `(event: D3ZoomEvent, userDriven: boolean) => void`.
   * Default value: `undefined`
   */
  onZoomEnd?: (e: D3ZoomEvent<HTMLCanvasElement, undefined>, userDriven: boolean) => void;

  /**
   * Callback function that will be called when dragging starts.
   * First argument is a D3 Drag Event:
   * `(event: D3DragEvent) => void`.
   * Default value: `undefined`
   */
  onDragStart?: (e: D3DragEvent<HTMLCanvasElement, undefined, Hovered>) => void;

  /**
   * Callback function that will be called continuously during dragging.
   * First argument is a D3 Drag Event:
   * `(event: D3DragEvent) => void`.
   * Default value: `undefined`
   */
  onDrag?: (e: D3DragEvent<HTMLCanvasElement, undefined, Hovered>) => void;

  /**
   * Callback function that will be called when dragging ends.
   * First argument is a D3 Drag Event:
   * `(event: D3DragEvent) => void`.
   * Default value: `undefined`
   */
  onDragEnd?: (e: D3DragEvent<HTMLCanvasElement, undefined, Hovered>) => void;

  /**
   * Show WebGL performance monitor.
   * Default value: `false`
   */
  showFPSMonitor: boolean;
  /**
   * Use the WebGPU device backend instead of WebGL2.
   *
   * When `true` and WebGPU is available in the host browser, the engine creates a
   * `webgpu` luma.gl device; otherwise it falls back to `webgl`. WebGPU unlocks
   * compute shaders, storage buffers, indirect draw, and significantly lower
   * driver overhead — the substrate Phase 4 (compute-shader Barnes-Hut, MRT-fused
   * forces) is built on.
   *
   * **This is currently a foundation step** — the WebGPU device boots, but shaders
   * still ship as GLSL targeting WebGL2. Until shader port (Phase 3.2) lands,
   * setting this to `true` will fail at pipeline creation. Use at your own risk
   * and watch the changelog.
   *
   * Default value: `false`
   */
  useWebGPU: boolean;
  /**
   * Enable per-pass GPU timing collection via `EXT_disjoint_timer_query_webgl2`.
   * When enabled, `graph.getGpuTimings()` returns a snapshot of average and last-sample
   * GPU time (ms) for each instrumented pass. Has near-zero overhead when the extension
   * is unavailable (Firefox in many configurations) or when no passes are wrapped.
   * Default value: `false`
   */
  enableGpuTimings: boolean;
  /**
   * Disable settled-frame render skipping.
   *
   * This is primarily a benchmark/diagnostic escape hatch. Normal applications
   * should leave it off so a settled graph does not redraw identical pixels.
   * When enabled, the render loop keeps submitting canvas passes even after the
   * simulation is stopped, which makes `enableSimulation: false` render-only GPU
   * timing sweeps measurable. It can also be useful for WebGPU viewer surfaces
   * where a static presented canvas may flash on the first interaction after a
   * long idle period.
   *
   * Default value: `false`
   */
  disableIdleFrameSkip: boolean;
  /**
   * Pixel ratio for the canvas. Higher values use more GPU memory but provide better quality on high-DPI displays.
   * Default value: `window.devicePixelRatio || 2`
   */
  pixelRatio: number;
  /**
   * Adaptive pixel ratio during interaction. When the user is panning, zooming,
   * or dragging, the canvas drops to this pixel ratio to keep frames cheap; on
   * settle (default ~150ms after the last interaction event) it restores to
   * `pixelRatio`. Fragment work is quadratic in pixel ratio, so 2.0 → 1.0
   * during pan typically gives a 4× render cost reduction on retina displays.
   *
   * - `false`: always use `pixelRatio`.
   * - `true`: use 1.0 during interaction.
   * - `number`: use this value during interaction.
   *
   * Default value: `true`
   */
  adaptivePixelRatio: boolean | number;
  /**
   * Milliseconds after the last interaction event before the canvas restores
   * the full pixelRatio. Default 150ms.
   */
  adaptivePixelRatioSettleMs: number;
  /**
   * Multi-sample anti-aliasing for the canvas render pass. WebGPU-only.
   *
   * - `1` (default): no MSAA. Analytic AA in the point/line fragment shaders
   *   handles edge smoothing.
   * - `4`: 4× MSAA. Produces noticeably smoother edges where analytic AA is
   *   weakest — short lines at oblique angles, small points crossing pixel
   *   boundaries, dense overlapping shapes. On Apple TBDR the multisample
   *   target lives in tile memory and resolves on tile store; the extra
   *   cost is typically only ~10-20% of a non-MSAA render at the same
   *   resolution because shaded samples are amortized via coverage masking.
   *
   * Memory cost: an MSAA render target sized to the canvas. At 1920×1080
   * × DPR=2 × 4 samples × 8 bytes/texel (rgba16float canvas), that's
   * ~265 MB. At higher resolutions (4K) the cost scales linearly; budget
   * before enabling on memory-constrained devices.
   */
  msaa: 1 | 4;
  /**
   * Increase or decrease the size of the points when zooming in or out.
   * Default value: `false`
   */
  scalePointsOnZoom: boolean;
  /**
   * Initial zoom level. This property will be applied only on component initialization and it
   * can't be changed using the `setConfig` or `setConfigPartial` methods.
   * If set, `fitViewOnInit` value will be ignored.
   * Default value: `undefined`
   */
  initialZoomLevel?: number;
  /**
   * Enables or disables zooming in and out.
   * Default value: `true`
   */
  enableZoom: boolean;
  /**
   * Minimum allowed camera zoom level.
   *
   * Default value: `0.001`
   */
  minZoomLevel: number;
  /**
   * Maximum allowed camera zoom level.
   *
   * `Infinity` preserves the historical unconstrained zoom behavior. Viewer
   * demos often want a finite cap so fast wheel gestures cannot zoom into a
   * sub-node empty patch and present an all-background frame.
   *
   * Default value: `Infinity`
   */
  maxZoomLevel: number;
  /**
   * Constrains pan/zoom translation to the graph's configured `spaceSize`.
   *
   * This is useful for demos and viewer-style canvases where a fast pan or
   * wheel gesture should not be able to fling the camera into empty space.
   * Library default stays unbounded for applications that manage their own
   * camera limits.
   *
   * Default value: `false`
   */
  constrainCameraToGraph: boolean;
  /**
   * Extra pan/zoom margin around `spaceSize`, expressed as a fraction of the
   * adjusted graph space. For example, `0.35` leaves 35% of the graph-space
   * size as overscroll padding on each side when `constrainCameraToGraph` is
   * enabled.
   *
   * Default value: `0.35`
   */
  cameraBoundsPadding: number;
  /**
   * Controls whether the simulation remains active during interactive (user-driven) zoom operations.
   * When set to `true`, the simulation continues running while zooming.
   * When set to `false`, the simulation pauses during zoom operations.
   * Programmatic zoom methods (e.g., `zoomToPointByIndex`, `fitView`) default to running the simulation
   * regardless of this setting, but can be controlled via their `enableSimulation` parameter.
   * Default value: `false`
   */
  enableSimulationDuringZoom: boolean;
  /**
   * Enables or disables dragging of points in the graph.
   * Default value: `false`
   */
  enableDrag: boolean;
  /**
   * Whether to center and zoom the view to fit all points in the scene on initialization or not.
   * Ignored if `initialZoomLevel` is set.
   * Default: `true`
   */
  fitViewOnInit: boolean;
  /**
   * Delay in milliseconds before fitting the view when `fitViewOnInit` is enabled.
   * Useful if you want the layout to stabilize a bit before fitting.
   * Default: `250`
   */
  fitViewDelay: number;
  /**
   * Padding to apply when fitting the view to show all points.
   * This value should be between 0 and 1, and is added to the calculated bounding box to provide some extra space around the points.
   * This is used when the `fitViewOnInit` option is enabled.
   * Default: `0.1`
   */
  fitViewPadding: number;
  /**
   * Duration in milliseconds for fitting the view to show all points when fitViewOnInit is enabled.
   * Default: `250`
   */
  fitViewDuration: number;
  /**
   * When `fitViewOnInit` is set to `true`, fits the view to show the points within a rectangle
   * defined by its two corner coordinates `[[left, bottom], [right, top]]` in the scene space.
   * Default: `undefined`
   */
  fitViewByPointsInRect?: [[number, number], [number, number]] | [number, number][];
  /**
   * When `fitViewOnInit` is set to `true`, fits the view to show only the specified points by their indices.
   * Takes precedence over `fitViewByPointsInRect` when both are provided.
   * Default: `undefined`
   */
  fitViewByPointIndices?: number[];
  /**
   * Providing a `randomSeed` value allows you to control
   * the randomness of the layout across different simulation runs.
   * It is useful when you want the graph to always look the same on same datasets.
   * This property will be applied only on component initialization and it
   * can't be changed using the `setConfig` or `setConfigPartial` methods.
   * Default value: undefined
   */
  randomSeed?: number | string;
  /**
   * Point sampling distance in pixels between neighboring points when calling the `getSampledPointPositionsMap` method.
   * This parameter determines how many points will be included in the sample.
   * Default value: `100`
  */
  pointSamplingDistance: number;
  /**
   * Link sampling distance in pixels between neighboring links when calling the `getSampledLinks` method.
   * This parameter determines how many links will be included in the sample (based on link midpoints in screen space).
   * Default value: `100`
   */
  linkSamplingDistance: number;
  /**
   * Controls automatic position adjustment of points in the visible space.
   *
   * When `undefined` (default):
   * - If simulation is disabled (`enableSimulation: false`), points will be automatically
   *   repositioned to fit within the visible space
   * - If simulation is enabled, points will not be rescaled
   *
   * When explicitly set:
   * - `true`: Forces points positions to be rescaled
   * - `false`: Forces points positions to not be rescaled
   *
   * Default value: `undefined`
   */
  rescalePositions?: boolean | undefined;
  /**
   * Controls the text shown in the bottom right corner.
   * - When a non-empty string is provided: Displays the string as HTML
   * - When empty string or not provided: No text is displayed
   *
   * This property is applied only on component initialization and
   * can't be changed using the `setConfig` or `setConfigPartial` methods.
   *
   * Default value: `''`
   */
  attribution: string;
}

/**
 * Requires all keys from T to be present, while preserving
 * the original value types (including `| undefined` for optional properties).
 */
export type Complete<T> = { [K in keyof Required<T>]: T[K] }

/**
 * Configuration options for the Graph constructor and `setConfig()` method.
 * All properties are optional — any omitted properties will use their default values.
 *
 * Note: calling `setConfig()` fully resets the configuration to defaults before
 * applying the provided values. Properties not included in the call will revert
 * to their defaults, not retain their previous values.
 */
export type GraphConfig = Partial<GraphConfigInterface>

/**
 * Returns a fresh copy of `defaultConfigValues` with arrays cloned so each Graph instance
 * gets its own copy rather than sharing array references with it.
 * `defaultConfigValues` is a module-level object — one instance shared across the entire codebase.
 * Called at construction time to initialise `Graph.config`, and via `resetConfigToDefaults` on every `setConfig()` call.
 */
export function createDefaultConfig (): GraphConfigInterface {
  const defaults: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(defaultConfigValues)) {
    defaults[key] = Array.isArray(value) ? [...value] : value
  }
  return defaults as unknown as GraphConfigInterface
}

/**
 * Resets the config object to default values in place, preserving the object reference
 * so that modules (Zoom, Store, etc.) that hold a reference to it stay in sync.
 * Called at the start of `setConfig()` to wipe previous values before applying the new ones.
 */
export function resetConfigToDefaults (target: GraphConfigInterface): void {
  Object.assign(target, createDefaultConfig())
}

/**
 * Applies `source` values onto `target` in place, leaving absent keys unchanged.
 *
 * Mutates in place rather than returning a new object, because multiple modules
 * (Zoom, Store, etc.) hold a reference to the same config object and need to
 * see updates immediately.
 *
 * Called in three places:
 * - Constructor: applies the optional initial config on top of defaults.
 * - `setConfig()`: applies a full replacement after `resetConfigToDefaults`.
 * - `setConfigPartial()`: with `useDefaultsForUndefined = true`, so explicit
 *   `undefined` values reset that property to its default.
 *
 * Arrays from `source` are stored by reference — callers must not mutate them after passing.
 */
export function applyConfig (
  target: GraphConfigInterface,
  source: GraphConfig,
  useDefaultsForUndefined = false
): void {
  const overrides: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) { // skip explicit undefined; handled below if useDefaultsForUndefined
      overrides[key] = value
    } else if (useDefaultsForUndefined) { // explicit undefined → reset to default
      const def = (defaultConfigValues as Record<string, unknown>)[key]
      overrides[key] = Array.isArray(def) ? [...def] : def // clone so target doesn't share the array with defaultConfigValues
    }
  }
  Object.assign(target, overrides)
}
