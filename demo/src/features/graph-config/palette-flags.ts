import { isWorkMode } from '../work-mode'
import type { DemoConfig } from '../control-plane/types'
import { isGalleryPalette } from '../../gallery-presets'

export function resolveDemoGraphPaletteFlags (cfg: DemoConfig) {
  const isLight = cfg.theme === 'light'
  const isWork = isWorkMode(cfg)
  const useSubnetPalette = cfg.palette === 'subnet' && isLight
  const useAnalystPalette = cfg.palette === 'analyst' && isLight
  return {
    isLight,
    isWork,
    useEmberPalette: cfg.palette === 'ember' && !isLight,
    useIonPalette: cfg.palette === 'ion' && !isLight,
    useSignalPalette: cfg.palette === 'signal' && !isLight,
    useCosmicPalette: cfg.palette === 'cosmic' && !isLight,
    useTokyoPalette: cfg.palette === 'tokyo' && !isLight,
    useInsightPalette: cfg.palette === 'insight' && !isLight,
    useFintechPalette: cfg.palette === 'fintech' && !isLight,
    useInfluencePalette: cfg.palette === 'influence' && !isLight,
    useTalentPalette: cfg.palette === 'talent' && !isLight,
    useSubnetPalette,
    useAnalystPalette,
    useGalleryPalette: (isGalleryPalette(cfg.palette) && !isLight) || useSubnetPalette || useAnalystPalette,
  }
}
