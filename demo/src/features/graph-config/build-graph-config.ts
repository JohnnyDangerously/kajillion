import type { GraphConfig } from '@kajillion/graph'
import { boolParam } from '../control-plane/controls'
import type { DemoConfig } from '../control-plane/types'
import { DEMO_SPACE_SIZE } from '../demo-lifecycle/demo-space'
import { resolveRepresentationFromUrl } from '../representations'
import {
  applyWorkModeGraphConfigOverlay,
  isWorkMode,
  resolveWorkModeGraphConfigPolicy,
  type WorkModeGraphConfigHooks,
} from '../work-mode'
import { buildDemoGraphLodConfig } from './lod-config'
import { resolveDemoGraphPaletteFlags } from './palette-flags'

export interface DemoGraphConfigHooks extends WorkModeGraphConfigHooks {}

function pointBorderTreatmentValue (mode: DemoConfig['pointBorderTreatment']): number {
  if (mode === 'off') return 0
  if (mode === 'darker') return 2
  if (mode === 'shadow') return 3
  if (mode === 'both') return 4
  return 1
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
  const useMassConservingLod = cfg.webgpu && !isWork && cfg.n >= 50000 && (cfg.lod || cfg.n >= 250000)
  const workPolicy = isWork
    ? resolveWorkModeGraphConfigPolicy(cfg, { useAnalystPalette })
    : { useAnalystMacroImpostors: false, useSmallAnalystExact: false }
  const commonConfig: GraphConfig = {
    spaceSize: DEMO_SPACE_SIZE,
    backgroundColor: useAnalystPalette || useSubnetPalette ? '#ffffff' : isLight ? '#fbfdff' : useCosmicPalette ? '#02040a' : useEmberPalette ? '#010101' : useIonPalette ? '#02030a' : useSignalPalette || useTokyoPalette || useInsightPalette || useInfluencePalette ? '#020202' : useFintechPalette ? '#0e1f2b' : useTalentPalette ? '#172333' : '#06090d',
    pointDefaultColor: useAnalystPalette ? '#ffffff' : useSubnetPalette ? '#7a3cff' : isLight ? '#005ff2' : useCosmicPalette ? '#ffc56a' : useEmberPalette ? '#fff5df' : useIonPalette ? '#97fbff' : useSignalPalette || useTokyoPalette ? '#f6f2e8' : useInsightPalette ? '#555555' : useFintechPalette ? '#2faee8' : useInfluencePalette ? '#ff3214' : useTalentPalette ? '#39a8df' : '#9bc7ff',
    pointDefaultSize: useCosmicPalette ? 1.28 : cfg.density ? 1.55 : 1.15,
    pointSizeScale: 1,
    pointOpacity: useAnalystPalette || useSubnetPalette || useCosmicPalette || useTokyoPalette || useSignalPalette || useInsightPalette || useFintechPalette || useInfluencePalette || useTalentPalette ? 1 : isLight ? (cfg.density ? 0.82 : 0.58) : cfg.lanes ? 0.72 : cfg.density ? 0.84 : 0.34,
    linkDefaultColor: useAnalystPalette ? '#111318' : useSubnetPalette ? '#7a3cff' : isLight ? '#2e486a' : useCosmicPalette ? '#a06c38' : useEmberPalette ? '#2b241c' : useIonPalette ? '#152040' : useSignalPalette ? '#ddd8ce' : useTokyoPalette ? '#d8d8d4' : useInsightPalette ? '#383838' : useFintechPalette ? '#2b8aaa' : useInfluencePalette ? '#4b3328' : useTalentPalette ? '#58a9ca' : '#273447',
    linkDefaultWidth: useAnalystPalette ? 0.86 : useSubnetPalette ? 1.65 : useCosmicPalette ? 0.48 : useTokyoPalette ? 0.38 : useSignalPalette ? 0.54 : useInsightPalette ? 0.68 : useFintechPalette ? 0.72 : useInfluencePalette ? 0.28 : useTalentPalette ? 0.0 : cfg.lanes ? (isLight ? 0.42 : 0.56) : cfg.density ? (isLight ? 0.32 : 0.42) : 0.26,
    linkWidthScale: useAnalystPalette ? 0.78 : isLight ? 0.92 : 1,
    linkOpacity: cfg.renderLinks
      ? cfg.lanes
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
    curvedLinkSegments: useCosmicPalette ? 14 : cfg.lanes ? 6 : 1,
    curvedLinkWeight: useCosmicPalette ? 0.92 : 0.8,
    curvedLinkControlPointDistance: useCosmicPalette ? 0.28 : 0.5,
    linkBundlingStrength: useCosmicPalette ? 0.24 : cfg.lanes ? 0.42 : 0,
    linkBundlingCellSize: useCosmicPalette ? 480 : 320,
    minZoomLevel: 0.001,
    maxZoomLevel: 8,
    rescalePositions: undefined,
    constrainCameraToGraph: true,
    cameraBoundsPadding: 0.12,
    fitViewOnInit: true,
    fitViewPadding: cfg.density ? 0.22 : 0.18,
    fitViewDuration: 260,
    enableSimulation: cfg.explore ? true : cfg.sim,
    enableDrag: false,
    physicsTickRate: 60,
    simulationFriction: 0.85,
    simulationRepulsion: 0.12,
    simulationGravity: 0.24,
    enableGpuTimings: cfg.debugFrameTrace || boolParam(new URLSearchParams(window.location.search).get('gpuTimings'), false),
    disableIdleFrameSkip: true,
    linkBlendMode: useCosmicPalette ? 'add' : (isLight || useGalleryPalette || useMassConservingLod) ? 'normal' : cfg.blend,
    hoveredPointCursor: 'default',
    hoveredLinkCursor: 'default',
    renderHoveredPointRing: false,
    hoveredPointRingColor: useAnalystPalette ? [0.05, 0.34, 0.74, 0.96] : useSubnetPalette ? [0.10, 0.28, 1.0, 0.92] : isLight ? [0.0, 0.24, 0.86, 0.96] : useSignalPalette || useTokyoPalette ? [1.0, 0.25, 0.02, 0.96] : [0.72, 0.92, 1.0, 0.86],
    focusedPointRingColor: useAnalystPalette ? [0.02, 0.40, 0.88, 1.0] : useSubnetPalette ? [1.0, 0.40, 0.0, 1.0] : isLight ? [0.98, 0.31, 0.0, 1.0] : useSignalPalette || useTokyoPalette ? [1.0, 0.28, 0.02, 1.0] : [0.95, 1.0, 1.0, 0.98],
    outlinedPointRingColor: useAnalystPalette ? [0.06, 0.07, 0.09, 0.78] : isLight ? [0.0, 0.32, 1.0, 0.70] : [0.72, 0.90, 1.0, 0.72],
    pointGreyoutOpacity: undefined,
    hoveredLinkColor: useAnalystPalette ? [0.02, 0.36, 0.78, 0.96] : isLight ? [0.0, 0.22, 0.74, 0.96] : [0.82, 0.94, 1.0, 0.92],
    hoveredLinkWidthIncrease: 2.25,
    focusedLinkWidthIncrease: 3.5,
    linkGreyoutOpacity: 0.1,
    onPointMouseOver: undefined,
    onPointMouseOut: undefined,
    onLinkMouseOver: undefined,
    onLinkMouseOut: undefined,
    onZoom: undefined,
    onZoomEnd: undefined,
    onPointClick: undefined,
    onLinkClick: undefined,
    onBackgroundClick: undefined,
    ...buildDemoGraphLodConfig({
      cfg,
      isLight,
      isWork,
      useAdditiveLinks,
      useAnalystMacroImpostors: workPolicy.useAnalystMacroImpostors,
      useMassConservingLod,
      useSmallAnalystExact: workPolicy.useSmallAnalystExact,
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
    pointBorderTreatment: pointBorderTreatmentValue(cfg.pointBorderTreatment),
    useWebGPU: cfg.webgpu,
    pixelRatio: window.devicePixelRatio || 1,
    adaptivePixelRatio: cfg.adaptiveDpr && !isLight && !useCosmicPalette ? 1 : false,
    msaa: cfg.webgpu && cfg.msaa && !useMassConservingLod ? 4 : 1,
    frameRateLimit: cfg.frameRateLimit,
    frameRateHeadroomFps: cfg.frameRateHeadroomFps,
    debugFrameTrace: cfg.debugFrameTrace,
  }

  const baseConfig = isWorkMode(cfg)
    ? applyWorkModeGraphConfigOverlay(
      commonConfig,
      cfg,
      {
        isLight,
        useAnalystPalette,
        useSignalPalette,
        useSubnetPalette,
        useTokyoPalette,
      },
      hooks,
      workPolicy
    )
    : commonConfig
  const representation = resolveRepresentationFromUrl()
  return representation?.applyGraphConfig
    ? representation.applyGraphConfig(baseConfig, cfg)
    : baseConfig
}
