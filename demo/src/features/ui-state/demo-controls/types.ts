import type { DemoConfig } from '../../control-plane/types'

export interface DemoControlActions {
  getCurrentConfig: () => DemoConfig;
  setCurrentConfig: (cfg: DemoConfig) => void;
  applyControlChange: () => Promise<void>;
  applyVisualControls: () => void;
  scheduleVisualControls: () => void;
  clearWorkFocus: (fitOverview: boolean) => void;
  fitWorkNeighborhood: () => void;
  stepIntoWorkPoint: () => void;
  rebuildGraph: (cfg: DemoConfig) => Promise<void>;
  resetCosmicIntroDismissal: () => void;
  handleError?: (err: unknown) => void;
}

export interface DemoControlController {
  syncNodeButtons: () => void;
  syncDependentControls: () => void;
  syncToggleButtons: () => void;
  setGalleryOpen: (open: boolean) => void;
}
