export interface SimulationConfig {
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
}

export { simulationDefaultConfigValues } from './simulation-defaults'
