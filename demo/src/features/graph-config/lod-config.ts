import type { GraphConfig } from '@kajillion/graph'
import type { DemoConfig } from '../control-plane/types'
import {
  ANALYST_MACRO_IMPOSTOR_MAX_ZOOM,
  ANALYST_MIN_ZOOM_LEVEL,
} from '../demo-lifecycle/demo-space'

interface DemoGraphLodConfigInputs {
  cfg: DemoConfig;
  isLight: boolean;
  isWork: boolean;
  useAdditiveLinks: boolean;
  useAnalystMacroImpostors: boolean;
  useMassConservingLod: boolean;
  useSmallAnalystExact: boolean;
}

type DemoGraphLodConfig = Pick<GraphConfig,
  'renderLodMode'
  | 'impostorDensityScale'
  | 'impostorTileSize'
  | 'impostorMicroSplats'
  | 'impostorTileOpacity'
  | 'impostorExactOverlay'
  | 'impostorStableOverlay'
  | 'impostorExactOverlaySampleRate'
  | 'impostorExactOverlayOpacity'
  | 'impostorExactOverlaySizeScale'
  | 'impostorSparseTileThreshold'
  | 'impostorSparseAnchorOpacity'
  | 'impostorAnchorsPerTile'
  | 'impostorPointSizeScale'
  | 'impostorCompositeStrength'
  | 'impostorMassRadiusScale'
  | 'impostorMassThreshold'
  | 'impostorMassMaxAlpha'
  | 'impostorMassColorBoost'
  | 'impostorMassExtrusion'
  | 'impostorAutoMinPoints'
  | 'impostorAutoMaxZoom'
  | 'linkLodStrength'
  | 'linkLodZoomRange'
  | 'linkLodMinSampleRate'
  | 'linkLodWidthCompensation'
  | 'linkLodOpacityCompensation'
>

export function buildDemoGraphLodConfig ({
  cfg,
  isLight,
  isWork,
  useAdditiveLinks,
  useAnalystMacroImpostors,
  useMassConservingLod,
  useSmallAnalystExact,
}: DemoGraphLodConfigInputs): DemoGraphLodConfig {
  return {
    renderLodMode: useAnalystMacroImpostors || useMassConservingLod ? 'auto' : useSmallAnalystExact ? 'phantom' : 'exact',
    impostorDensityScale: useAnalystMacroImpostors ? 3 : useMassConservingLod ? 2 : cfg.density ? 4 : 5,
    impostorTileSize: useAnalystMacroImpostors ? 6 : useMassConservingLod ? 4 : 7,
    impostorMicroSplats: useMassConservingLod ? 1 : 1,
    impostorTileOpacity: useAnalystMacroImpostors
      ? 0.0018
      : useMassConservingLod
      ? isLight
        ? 0
        : 0.00045
      : useAdditiveLinks ? 0.006 : isLight ? 0.024 : 0.04,
    impostorExactOverlay: true,
    impostorStableOverlay: useAnalystMacroImpostors && cfg.n <= 10000,
    impostorExactOverlaySampleRate: useAnalystMacroImpostors
      ? cfg.n <= 10000 ? 0.48 : 0.18
      : useMassConservingLod
      ? cfg.n >= 500000
        ? 0.045
        : cfg.n >= 250000
          ? 0.060
          : 0.090
      : cfg.density ? 0.38 : 0.34,
    impostorExactOverlayOpacity: useAnalystMacroImpostors
      ? 0.92
      : useMassConservingLod
      ? isLight
        ? 0.42
        : 0.34
      : useAdditiveLinks ? 0.74 : isLight ? 0.58 : 0.82,
    impostorExactOverlaySizeScale: useAnalystMacroImpostors ? cfg.n <= 10000 ? 4.2 : 0.96 : useMassConservingLod ? 0.72 : 0.86,
    impostorSparseTileThreshold: useAnalystMacroImpostors ? 0 : useMassConservingLod ? 2 : 5,
    impostorSparseAnchorOpacity: useAnalystMacroImpostors ? 0.88 : useMassConservingLod ? 0.50 : 0.95,
    impostorAnchorsPerTile: useAnalystMacroImpostors ? 6 : useMassConservingLod ? (cfg.n >= 500000 ? 2 : 3) : cfg.density ? 6 : 5,
    impostorPointSizeScale: useAnalystMacroImpostors ? 0.96 : useMassConservingLod ? 0.78 : 1.0,
    impostorCompositeStrength: useAnalystMacroImpostors ? 0.34 : useMassConservingLod ? (isLight ? 0 : 0.025) : useAdditiveLinks ? 0.24 : isLight ? 0.34 : 0.48,
    impostorMassRadiusScale: useAnalystMacroImpostors
      ? 0.94
      : useMassConservingLod
      ? isLight
        ? 0.92
        : 1.28
      : isLight ? 0.86 : 1.0,
    impostorMassThreshold: useAnalystMacroImpostors
      ? 0.11
      : useMassConservingLod
      ? isLight
        ? 0.18
        : 0.10
      : isLight ? 0.14 : 0.08,
    impostorMassMaxAlpha: useAnalystMacroImpostors
      ? 0.038
      : useMassConservingLod
      ? isLight
        ? 0.018
        : 0.052
      : isLight ? 0.035 : 0.08,
    impostorMassColorBoost: useAnalystMacroImpostors
      ? 1.34
      : useMassConservingLod
      ? isLight
        ? 1.22
        : 1.45
      : 1,
    impostorMassExtrusion: (useAnalystMacroImpostors || useMassConservingLod) && cfg.tilt ? 0.36 : 0,
    impostorAutoMinPoints: useAnalystMacroImpostors ? 1 : isWork ? 1_000_000 : useMassConservingLod ? 50000 : 500000,
    impostorAutoMaxZoom: useAnalystMacroImpostors ? ANALYST_MACRO_IMPOSTOR_MAX_ZOOM : useMassConservingLod ? 0.52 : 0.28,
    linkLodStrength: useAnalystMacroImpostors ? 0.58 : useMassConservingLod ? (cfg.lanes ? 0.68 : 0.78) : 0,
    linkLodZoomRange: useAnalystMacroImpostors ? [ANALYST_MIN_ZOOM_LEVEL, ANALYST_MACRO_IMPOSTOR_MAX_ZOOM] : [0.14, 0.90],
    linkLodMinSampleRate: useAnalystMacroImpostors
      ? 0.08
      : useMassConservingLod
      ? isLight
        ? (cfg.lanes ? 0.06 : 0.035)
        : (cfg.lanes ? 0.08 : 0.045)
      : isLight ? (cfg.lanes ? 0.18 : 0.14) : cfg.lanes ? 0.30 : 0.20,
    linkLodWidthCompensation: useAnalystMacroImpostors ? 0.14 : useMassConservingLod ? (cfg.lanes ? 0.16 : 0.10) : isLight ? 0.26 : cfg.lanes ? 0.38 : 0.22,
    linkLodOpacityCompensation: useAnalystMacroImpostors ? 0.12 : useMassConservingLod ? (isLight ? 0.12 : 0.18) : useAdditiveLinks ? 0.25 : isLight ? 0.22 : 0.62,
  }
}
