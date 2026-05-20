import type { GalleryPalette } from '../../gallery-presets'

export interface WorkModeConfigShape {
  dataMode: 'cosmo' | 'ba' | 'work';
  n: number;
  palette?: GalleryPalette;
}

export interface WorkModeCameraProfile {
  initialFitDurationMs: number;
  initialFitPadding: number;
  overviewFitDurationMs: number;
  overviewFitPadding: number;
  focusFitDurationMs: number;
  focusFitPadding: number;
  linkFitDurationMs: number;
  linkFitPadding: number;
  stepFitDurationMs: number;
  stepFitPadding: number;
}

export interface WorkModeInteractionProfile {
  closeZoomDistance: number;
  focusPointGreyoutDark: number;
  focusPointGreyoutLight: number;
  focusLinkGreyoutDark: number;
  focusLinkGreyoutLight: number;
}

export const WORK_MODE_DATA_MODE = 'work'
export const WORK_MODE_SMALL_GRAPH_MAX_N = 1000

export const WORK_MODE_CAMERA: WorkModeCameraProfile = {
  initialFitDurationMs: 420,
  initialFitPadding: 0.18,
  overviewFitDurationMs: 420,
  overviewFitPadding: 0.16,
  focusFitDurationMs: 460,
  focusFitPadding: 0.34,
  linkFitDurationMs: 360,
  linkFitPadding: 0.36,
  stepFitDurationMs: 340,
  stepFitPadding: 0.44,
}

export const WORK_MODE_INTERACTION: WorkModeInteractionProfile = {
  closeZoomDistance: 25,
  focusPointGreyoutDark: 0.18,
  focusPointGreyoutLight: 0.14,
  focusLinkGreyoutDark: 0.08,
  focusLinkGreyoutLight: 0.06,
}

export function isWorkMode (cfg: WorkModeConfigShape): boolean {
  return cfg.dataMode === WORK_MODE_DATA_MODE ||
    (cfg.n <= WORK_MODE_SMALL_GRAPH_MAX_N && (!cfg.palette || cfg.palette === 'category'))
}

export function isExplicitWorkDataset (cfg: Pick<WorkModeConfigShape, 'dataMode'>): boolean {
  return cfg.dataMode === WORK_MODE_DATA_MODE
}
