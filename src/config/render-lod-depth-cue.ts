export interface RenderDepthCueConfig {
  /**
   * Strength of subtle 2.5D perceptual depth cues for WebGPU point rendering.
   * This keeps the graph logically 2D while modulating node size, opacity,
   * brightness, rim, and micro-shadow from a stable visual-depth signal.
   *
   * `0` disables the treatment. Values around `0.25-0.45` should read as
   * polish/depth, not an explicit 3D mode.
   *
   * Default value: `0`
   */
  pointDepthCueStrength: number;
  /**
   * Size contribution for `pointDepthCueStrength`. This is intentionally
   * subtle; large values make depth look like data encoding.
   *
   * Default value: `0.08`
   */
  pointDepthCueSize: number;
  /**
   * Brightness contribution for `pointDepthCueStrength`.
   *
   * Default value: `0.12`
   */
  pointDepthCueBrightness: number;
  /**
   * Opacity contribution for `pointDepthCueStrength`.
   *
   * Default value: `0.14`
   */
  pointDepthCueOpacity: number;
  /**
   * Micro moat/shadow contribution for `pointDepthCueStrength`.
   *
   * Default value: `0.16`
   */
  pointDepthCueMoat: number;
  /**
   * Soft top-left highlight contribution for `pointDepthCueStrength`.
   * This is a perceptual polish cue, not a physically correct light.
   *
   * Default value: `0.18`
   */
  pointDepthCueHighlight: number;
  /**
   * Contact/dome shadow contribution for `pointDepthCueStrength`.
   *
   * Default value: `0.18`
   */
  pointDepthCueShadow: number;
  /**
   * Saturation variation across the stable visual-depth signal.
   *
   * Default value: `0.12`
   */
  pointDepthCueSaturation: number;
}

export const renderDepthCueDefaultConfigValues = {
  pointDepthCueStrength: 0,
  pointDepthCueSize: 0.08,
  pointDepthCueBrightness: 0.12,
  pointDepthCueOpacity: 0.14,
  pointDepthCueMoat: 0.16,
  pointDepthCueHighlight: 0.18,
  pointDepthCueShadow: 0.18,
  pointDepthCueSaturation: 0.12,
} satisfies RenderDepthCueConfig
