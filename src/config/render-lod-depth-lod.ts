export interface RenderPointLodConfig {
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
   * Maximum exact point sprites selected per screen-space tile by the WebGPU
   * culling path. This is a deterministic GPU-side top-K budget for zoomed-out
   * views: dense tiles keep a few representative real nodes and skip the rest
   * before the indirect draw.
   *
   * Set to `0` to disable.
   *
   * Default value: `0`
   */
  pointTileBudget: number;
  /**
   * Screen-space tile size, in device pixels, used by `pointTileBudget`.
   *
   * Default value: `22`
   */
  pointTileBudgetSize: number;
  /**
   * Maximum camera scale where `pointTileBudget` is active. Above this scale
   * close inspection draws all exact nodes that pass normal culling so work
   * mode remains precise and clickable.
   *
   * Set to `0` to keep the budget active at every zoom while configured.
   *
   * Default value: `0.9`
   */
  pointTileBudgetMaxScale: number;
}

export interface RenderLinkLodConfig {
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
}

export interface RenderLodSamplingConfig extends RenderPointLodConfig, RenderLinkLodConfig {}

export const renderPointLodDefaultConfigValues = {
  pointLodStrength: 0,
  pointLodZoomRange: [0.12, 0.65],
  pointLodMinSampleRate: 0.45,
  pointLodSizeCompensation: 0.55,
  pointLodOpacityCompensation: 0.75,
  pointTileBudget: 0,
  pointTileBudgetSize: 22,
  pointTileBudgetMaxScale: 0.9,
} satisfies RenderPointLodConfig

export const renderLinkLodDefaultConfigValues = {
  linkLodStrength: 0,
  linkLodZoomRange: [0.10, 0.60],
  linkLodMinSampleRate: 0.35,
  linkLodWidthCompensation: 0.35,
  linkLodOpacityCompensation: 0.65,
} satisfies RenderLinkLodConfig

export const renderLodSamplingDefaultConfigValues = {
  ...renderPointLodDefaultConfigValues,
  ...renderLinkLodDefaultConfigValues,
} satisfies RenderLodSamplingConfig
