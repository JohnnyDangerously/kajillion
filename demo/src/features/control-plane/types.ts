import type { GalleryPalette } from '../../gallery-presets'

export interface DemoConfig {
  n: number;
  dataMode: 'cosmo' | 'ba' | 'work';
  seed: number;
  webgpu: boolean;
  msaa: boolean;
  adaptiveDpr: boolean;
  theme: 'dark' | 'light';
  palette: GalleryPalette;
  blend: 'add' | 'normal';
  sim: boolean;
  renderLinks: boolean;
  density: boolean;
  lod: boolean;
  lanes: boolean;
  tilt: boolean;
  depthPreset: DepthPreset;
  pointDepthCueStrength: number;
  pointDepthCueSize: number;
  pointDepthCueBrightness: number;
  pointDepthCueOpacity: number;
  pointDepthCueMoat: number;
  pointDepthCueHighlight: number;
  pointDepthCueShadow: number;
  pointDepthCueSaturation: number;
  pointTileBudget: number;
  pointTileBudgetSize: number;
  pointTileBudgetMaxScale: number;
  massConserve: boolean;
  debugFrameTrace: boolean;
  frameRateLimit: number;
  frameRateHeadroomFps: number;
  /** Explore graphs: keep work-mode interactions but run the force sim. */
  explore?: boolean;
}

export type DepthPreset = 'off' | 'subtle' | 'standard' | 'vivid' | 'custom'
