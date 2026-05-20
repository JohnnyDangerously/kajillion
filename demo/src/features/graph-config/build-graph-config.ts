import type { GraphConfig } from '@kajillion/graph'
import { boolParam } from '../control-plane/controls'
import type { DemoConfig } from '../control-plane/types'
import {
  ANALYST_MAX_ZOOM_LEVEL,
  ANALYST_MIN_ZOOM_LEVEL,
  DEMO_SPACE_SIZE,
} from '../demo-lifecycle/demo-space'
import { buildDemoGraphLodConfig } from './lod-config'
import { resolveDemoGraphPaletteFlags } from './palette-flags'

export interface DemoGraphConfigHooks {
  previewWorkPoint: (index: number) => void;
  clearWorkPreview: () => void;
  previewWorkLink: (index: number) => void;
  focusWorkPoint: (index: number, fit: boolean) => void;
  exploreNodeClickHook: ((index: number) => void) | undefined;
  focusWorkLink: (index: number, fit: boolean) => void;
  clearWorkFocus: (fit: boolean) => void;
  scheduleAnalystZoomVisualRefresh: (force: boolean) => void;
}

export function buildDemoGraphConfig (cfg: DemoConfig, hooks: DemoGraphConfigHooks): GraphConfig {
  const {
    isLight,
    isWork,
    useEmberPalette,
    useIonPalette,
    useSignalPalette,
    useCosmicPalette,
    useTokyoPalette,
    useInsightPalette,
    useFintechPalette,
    useInfluencePalette,
    useTalentPalette,
    useSubnetPalette,
    useAnalystPalette,
    useGalleryPalette,
  } = resolveDemoGraphPaletteFlags(cfg)
  const useAdditiveLinks = cfg.blend === 'add' && !isLight
  const enableInteractions = isWork
  const useMassConservingLod = cfg.webgpu && !isWork && cfg.n >= 50000 && (cfg.lod || cfg.n >= 250000)
  // Keep small analyst/work graphs exact across the whole zoom range. The
  // impostor handoff is useful at scale, but at 4k it creates a visible
  // strategy switch during scroll zoom for no real performance win.
  const useAnalystMacroImpostors = cfg.webgpu && isWork && useAnalystPalette && cfg.density && cfg.lod && cfg.n >= 50000
  const useSmallAnalystExact = isWork && useAnalystPalette && !useAnalystMacroImpostors
  return {
    spaceSize: DEMO_SPACE_SIZE,
    backgroundColor: useAnalystPalette || useSubnetPalette ? '#ffffff' : isLight ? '#fbfdff' : useCosmicPalette ? '#02040a' : useEmberPalette ? '#010101' : useIonPalette ? '#02030a' : useSignalPalette || useTokyoPalette || useInsightPalette || useInfluencePalette ? '#020202' : useFintechPalette ? '#0e1f2b' : useTalentPalette ? '#172333' : (isWork ? '#05070b' : '#06090d'),
    pointDefaultColor: useAnalystPalette ? '#ffffff' : useSubnetPalette ? '#7a3cff' : isLight ? '#005ff2' : useCosmicPalette ? '#ffc56a' : useEmberPalette ? '#fff5df' : useIonPalette ? '#97fbff' : useSignalPalette || useTokyoPalette ? '#f6f2e8' : useInsightPalette ? '#555555' : useFintechPalette ? '#2faee8' : useInfluencePalette ? '#ff3214' : useTalentPalette ? '#39a8df' : '#9bc7ff',
    pointDefaultSize: isWork ? (useAnalystPalette ? 11.5 : 10.25) : useCosmicPalette ? 1.28 : cfg.density ? 1.55 : 1.15,
    pointSizeScale: isWork ? (useAnalystPalette ? 1.0 : 1.14) : 1,
    pointOpacity: useAnalystPalette || useSubnetPalette || useCosmicPalette || useTokyoPalette || useSignalPalette || useInsightPalette || useFintechPalette || useInfluencePalette || useTalentPalette ? 1 : isWork ? 1 : isLight ? (cfg.density ? 0.82 : 0.58) : cfg.lanes ? 0.72 : cfg.density ? 0.84 : 0.34,
    linkDefaultColor: useAnalystPalette ? '#111318' : useSubnetPalette ? '#7a3cff' : isLight ? '#2e486a' : useCosmicPalette ? '#a06c38' : useEmberPalette ? '#2b241c' : useIonPalette ? '#152040' : useSignalPalette ? '#ddd8ce' : useTokyoPalette ? '#d8d8d4' : useInsightPalette ? '#383838' : useFintechPalette ? '#2b8aaa' : useInfluencePalette ? '#4b3328' : useTalentPalette ? '#58a9ca' : '#273447',
    linkDefaultWidth: useAnalystPalette ? 0.86 : useSubnetPalette ? 1.65 : isWork ? 2.05 : useCosmicPalette ? 0.48 : useTokyoPalette ? 0.38 : useSignalPalette ? 0.54 : useInsightPalette ? 0.68 : useFintechPalette ? 0.72 : useInfluencePalette ? 0.28 : useTalentPalette ? 0.0 : cfg.lanes ? (isLight ? 0.42 : 0.56) : cfg.density ? (isLight ? 0.32 : 0.42) : 0.26,
    linkWidthScale: useAnalystPalette ? 0.78 : isWork ? 1.06 : isLight ? 0.92 : 1,
    linkOpacity: cfg.renderLinks
      ? isWork
        ? useAnalystPalette ? 0.92 : useSubnetPalette ? 0.82 : (isLight ? 0.82 : 0.80)
        : cfg.lanes
          ? isLight
            ? useMassConservingLod ? 0.060 : (useAdditiveLinks ? 0.62 : 0.18)
            : useMassConservingLod ? 0.060 : useEmberPalette ? 0.34 : useIonPalette ? 0.40 : useSignalPalette ? 0.58 : useTokyoPalette ? 0.32 : (cfg.blend === 'add' ? 0.46 : 0.72)
          : cfg.density
            ? isLight
              ? useMassConservingLod ? 0.050 : (useAdditiveLinks ? 0.56 : 0.16)
              : useMassConservingLod ? 0.045 : useEmberPalette ? 0.26 : useIonPalette ? 0.32 : useSignalPalette ? 0.46 : useTokyoPalette ? 0.28 : (cfg.blend === 'add' ? 0.42 : 0.62)
            : isLight
              ? useMassConservingLod ? 0.026 : (useAdditiveLinks ? 0.07 : 0.10)
            : useMassConservingLod ? 0.024 : useCosmicPalette ? 0.24 : useEmberPalette ? 0.030 : useIonPalette ? 0.040 : useSignalPalette ? 0.64 : useTokyoPalette ? 0.82 : useInsightPalette ? 0.72 : useFintechPalette ? 0.64 : useInfluencePalette ? 0.50 : useTalentPalette ? 0 : (cfg.blend === 'add' ? 0.018 : 0.045)
      : 0,
    renderLinks: cfg.renderLinks,
    curvedLinks: cfg.lanes,
    curvedLinkSegments: isWork ? (cfg.lanes ? 22 : 1) : useCosmicPalette ? 14 : cfg.lanes ? 6 : 1,
    curvedLinkWeight: isWork ? 0.84 : useCosmicPalette ? 0.92 : 0.8,
    curvedLinkControlPointDistance: isWork ? (cfg.lanes ? 0.16 : 0) : useCosmicPalette ? 0.28 : 0.5,
    linkBundlingStrength: isWork ? (cfg.lanes ? 0.035 : 0) : useCosmicPalette ? 0.24 : cfg.lanes ? 0.42 : 0,
    linkBundlingCellSize: isWork ? 260 : useCosmicPalette ? 480 : 320,
    minZoomLevel: isWork && useAnalystPalette ? ANALYST_MIN_ZOOM_LEVEL : 0.001,
    maxZoomLevel: isWork ? (useAnalystPalette ? ANALYST_MAX_ZOOM_LEVEL : 10) : 8,
    rescalePositions: isWork ? false : undefined,
    constrainCameraToGraph: true,
    cameraBoundsPadding: 0.12,
    fitViewOnInit: !isWork,
    fitViewPadding: isWork ? 0.16 : (cfg.density ? 0.22 : 0.18),
    fitViewDuration: isWork ? 520 : 260,
    enableSimulation: cfg.explore ? true : (isWork ? false : cfg.sim),
    enableDrag: isWork,
    physicsTickRate: 60,
    simulationFriction: (isWork && !cfg.explore) ? 0.90 : 0.85,
    simulationRepulsion: (isWork && !cfg.explore) ? 0.035 : 0.12,
    simulationGravity: (isWork && !cfg.explore) ? 0.08 : 0.24,
    enableGpuTimings: cfg.debugFrameTrace || boolParam(new URLSearchParams(window.location.search).get('gpuTimings'), false),
    disableIdleFrameSkip: true,
    linkBlendMode: useCosmicPalette ? 'add' : (isWork || isLight || useGalleryPalette || useMassConservingLod) ? 'normal' : cfg.blend,
    hoveredPointCursor: enableInteractions ? 'pointer' : 'default',
    hoveredLinkCursor: enableInteractions ? 'pointer' : 'default',
    renderHoveredPointRing: enableInteractions,
    hoveredPointRingColor: useAnalystPalette ? [0.05, 0.34, 0.74, 0.96] : useSubnetPalette ? [0.10, 0.28, 1.0, 0.92] : isLight ? [0.0, 0.24, 0.86, 0.96] : useSignalPalette || useTokyoPalette ? [1.0, 0.25, 0.02, 0.96] : isWork ? [0.98, 0.98, 1.0, 0.92] : [0.72, 0.92, 1.0, 0.86],
    focusedPointRingColor: useAnalystPalette ? [0.02, 0.40, 0.88, 1.0] : useSubnetPalette ? [1.0, 0.40, 0.0, 1.0] : isLight ? [0.98, 0.31, 0.0, 1.0] : useSignalPalette || useTokyoPalette ? [1.0, 0.28, 0.02, 1.0] : isWork ? [1.0, 0.92, 0.68, 1.0] : [0.95, 1.0, 1.0, 0.98],
    outlinedPointRingColor: useAnalystPalette ? [0.06, 0.07, 0.09, 0.78] : isLight ? [0.0, 0.32, 1.0, 0.70] : [0.72, 0.90, 1.0, 0.72],
    pointGreyoutOpacity: isWork ? (useAnalystPalette ? 0.26 : isLight ? 0.16 : 0.20) : undefined,
    hoveredLinkColor: useAnalystPalette ? [0.02, 0.36, 0.78, 0.96] : isLight ? [0.0, 0.22, 0.74, 0.96] : [0.82, 0.94, 1.0, 0.92],
    hoveredLinkWidthIncrease: isWork ? (useAnalystPalette ? 1.8 : 2.8) : 2.25,
    focusedLinkWidthIncrease: isWork ? (useAnalystPalette ? 3.2 : 4.2) : 3.5,
    linkGreyoutOpacity: isWork ? (useAnalystPalette ? 0.13 : isLight ? 0.08 : 0.10) : 0.1,
    onPointMouseOver: enableInteractions ? (index) => { hooks.previewWorkPoint(index) } : undefined,
    onPointMouseOut: enableInteractions ? () => { hooks.clearWorkPreview() } : undefined,
    onLinkMouseOver: enableInteractions ? (index) => { hooks.previewWorkLink(index) } : undefined,
    onLinkMouseOut: enableInteractions ? () => { hooks.clearWorkPreview() } : undefined,
    onZoom: useSmallAnalystExact ? () => { hooks.scheduleAnalystZoomVisualRefresh(false) } : undefined,
    onZoomEnd: useSmallAnalystExact ? () => { hooks.scheduleAnalystZoomVisualRefresh(false) } : undefined,
    onPointClick: enableInteractions
      ? (index) => {
        hooks.focusWorkPoint(index, false)
        hooks.exploreNodeClickHook?.(index)
      }
      : undefined,
    onLinkClick: enableInteractions
      ? (index) => {
        hooks.focusWorkLink(index, false)
      }
      : undefined,
    onBackgroundClick: enableInteractions
      ? () => {
        hooks.clearWorkFocus(false)
      }
      : undefined,
    ...buildDemoGraphLodConfig({
      cfg,
      isLight,
      isWork,
      useAdditiveLinks,
      useAnalystMacroImpostors,
      useMassConservingLod,
      useSmallAnalystExact,
    }),
    linkMinPixelLength: 0,
    pointMinPixelSize: 0,
    pointLodStrength: 0,
    pointLodZoomRange: [0.14, 0.95],
    pointLodMinSampleRate: cfg.density ? 0.22 : 0.32,
    pointLodSizeCompensation: 0.46,
    pointLodOpacityCompensation: useAdditiveLinks ? 0.34 : isLight ? 0.38 : 0.62,
    pointTileBudget: cfg.pointTileBudget,
    pointTileBudgetSize: cfg.pointTileBudgetSize,
    pointTileBudgetMaxScale: cfg.pointTileBudgetMaxScale,
    pointDepthCueStrength: cfg.pointDepthCueStrength,
    pointDepthCueSize: cfg.pointDepthCueSize,
    pointDepthCueBrightness: cfg.pointDepthCueBrightness,
    pointDepthCueOpacity: cfg.pointDepthCueOpacity,
    pointDepthCueMoat: cfg.pointDepthCueMoat,
    pointDepthCueHighlight: cfg.pointDepthCueHighlight,
    pointDepthCueShadow: cfg.pointDepthCueShadow,
    pointDepthCueSaturation: cfg.pointDepthCueSaturation,
    useWebGPU: cfg.webgpu,
    pixelRatio: window.devicePixelRatio || 1,
    adaptivePixelRatio: cfg.adaptiveDpr && !isLight && !useCosmicPalette ? 1 : false,
    msaa: cfg.webgpu && cfg.msaa && !useMassConservingLod ? 4 : 1,
    frameRateLimit: cfg.frameRateLimit,
    frameRateHeadroomFps: cfg.frameRateHeadroomFps,
    debugFrameTrace: cfg.debugFrameTrace,
  }
}
