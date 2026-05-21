import type { GraphConfig } from '@kajillion/graph'
import type { DemoConfig } from '../control-plane/types'
import {
  ANALYST_MAX_ZOOM_LEVEL,
  ANALYST_MIN_ZOOM_LEVEL,
} from '../demo-lifecycle/demo-space'

export interface WorkModeGraphConfigHooks {
  previewWorkPoint: (index: number) => void;
  clearWorkPreview: () => void;
  previewWorkLink: (index: number) => void;
  focusWorkPoint: (index: number, fit: boolean) => void;
  exploreNodeClickHook: ((index: number) => void) | undefined;
  focusWorkLink: (index: number, fit: boolean) => void;
  clearWorkFocus: (fit: boolean) => void;
  scheduleAnalystZoomVisualRefresh: (force: boolean) => void;
}

export interface WorkModeGraphConfigPaletteFlags {
  isLight: boolean;
  useAnalystPalette: boolean;
  useSignalPalette: boolean;
  useSubnetPalette: boolean;
  useTokyoPalette: boolean;
}

export interface WorkModeGraphConfigPolicy {
  useAnalystMacroImpostors: boolean;
  useSmallAnalystExact: boolean;
}

export function resolveWorkModeGraphConfigPolicy (
  cfg: DemoConfig,
  flags: Pick<WorkModeGraphConfigPaletteFlags, 'useAnalystPalette'>
): WorkModeGraphConfigPolicy {
  // Keep small analyst/work graphs exact across the whole zoom range. The
  // impostor handoff is useful at scale, but at 4k it creates a visible
  // strategy switch during scroll zoom for no real performance win.
  const useAnalystMacroImpostors = cfg.webgpu &&
    flags.useAnalystPalette &&
    cfg.density &&
    cfg.lod &&
    cfg.n >= 500000

  return {
    useAnalystMacroImpostors,
    useSmallAnalystExact: flags.useAnalystPalette && !useAnalystMacroImpostors,
  }
}

export function applyWorkModeGraphConfigOverlay (
  config: GraphConfig,
  cfg: DemoConfig,
  flags: WorkModeGraphConfigPaletteFlags,
  hooks: WorkModeGraphConfigHooks,
  policy: WorkModeGraphConfigPolicy
): GraphConfig {
  const {
    isLight,
    useAnalystPalette,
    useSignalPalette,
    useSubnetPalette,
    useTokyoPalette,
  } = flags
  const useLargeAtlas = cfg.n >= 50000 && !policy.useAnalystMacroImpostors

  return {
    ...config,
    backgroundColor: useAnalystPalette || useSubnetPalette
      ? '#ffffff'
      : config.backgroundColor === '#06090d'
        ? '#05070b'
        : config.backgroundColor,
    pointDefaultSize: useLargeAtlas ? 4.8 : useAnalystPalette ? 11.5 : 10.25,
    pointSizeScale: useLargeAtlas ? 0.86 : useAnalystPalette ? 1.0 : 1.14,
    pointOpacity: 1,
    linkDefaultWidth: useLargeAtlas ? 0.52 : useAnalystPalette ? 0.86 : useSubnetPalette ? 1.65 : 2.05,
    linkWidthScale: useLargeAtlas ? 0.50 : useAnalystPalette ? 0.78 : 1.06,
    linkOpacity: cfg.renderLinks
      ? useLargeAtlas ? (isLight ? 0.24 : 0.36) : useAnalystPalette ? 0.92 : useSubnetPalette ? 0.82 : (isLight ? 0.82 : 0.80)
      : 0,
    curvedLinkSegments: useLargeAtlas ? (cfg.lanes ? 5 : 1) : cfg.lanes ? 22 : 1,
    curvedLinkWeight: useLargeAtlas ? 0.58 : 0.84,
    curvedLinkControlPointDistance: useLargeAtlas ? (cfg.lanes ? 0.035 : 0) : cfg.lanes ? 0.16 : 0,
    linkBundlingStrength: useLargeAtlas ? 0 : cfg.lanes ? 0.035 : 0,
    linkBundlingCellSize: 260,
    pointTileBudget: useLargeAtlas ? Math.max(config.pointTileBudget ?? 0, 28) : config.pointTileBudget,
    pointTileBudgetSize: useLargeAtlas ? Math.min(config.pointTileBudgetSize ?? 18, 14) : config.pointTileBudgetSize,
    minZoomLevel: useLargeAtlas ? 0.060 : useAnalystPalette ? ANALYST_MIN_ZOOM_LEVEL : 0.001,
    maxZoomLevel: useLargeAtlas ? 7.5 : useAnalystPalette ? ANALYST_MAX_ZOOM_LEVEL : 10,
    rescalePositions: false,
    renderLodMode: useLargeAtlas && cfg.webgpu && cfg.lod ? 'phantom' : config.renderLodMode,
    fitViewOnInit: useLargeAtlas,
    fitViewPadding: useLargeAtlas ? 0.17 : 0.16,
    fitViewDuration: 520,
    enableSimulation: cfg.explore ? true : false,
    enableDrag: true,
    simulationFriction: cfg.explore ? 0.85 : 0.90,
    simulationRepulsion: cfg.explore ? 0.12 : 0.035,
    simulationGravity: cfg.explore ? 0.24 : 0.08,
    linkBlendMode: 'normal',
    hoveredPointCursor: 'pointer',
    hoveredLinkCursor: 'pointer',
    renderHoveredPointRing: true,
    hoveredPointRingColor: useAnalystPalette
      ? [0.05, 0.34, 0.74, 0.96]
      : useSubnetPalette
        ? [0.10, 0.28, 1.0, 0.92]
        : isLight
          ? [0.0, 0.24, 0.86, 0.96]
          : useSignalPalette || useTokyoPalette
            ? [1.0, 0.25, 0.02, 0.96]
            : [0.98, 0.98, 1.0, 0.92],
    focusedPointRingColor: useAnalystPalette
      ? [0.02, 0.40, 0.88, 1.0]
      : useSubnetPalette
        ? [1.0, 0.40, 0.0, 1.0]
        : isLight
          ? [0.98, 0.31, 0.0, 1.0]
          : useSignalPalette || useTokyoPalette
            ? [1.0, 0.28, 0.02, 1.0]
            : [1.0, 0.92, 0.68, 1.0],
    pointGreyoutOpacity: useAnalystPalette ? 0.26 : isLight ? 0.16 : 0.20,
    hoveredLinkWidthIncrease: useAnalystPalette ? 1.8 : 2.8,
    focusedLinkWidthIncrease: useAnalystPalette ? 3.2 : 4.2,
    linkGreyoutOpacity: useAnalystPalette ? 0.13 : isLight ? 0.08 : 0.10,
    onPointMouseOver: (index) => { hooks.previewWorkPoint(index) },
    onPointMouseOut: () => { hooks.clearWorkPreview() },
    onLinkMouseOver: (index) => { hooks.previewWorkLink(index) },
    onLinkMouseOut: () => { hooks.clearWorkPreview() },
    onZoom: policy.useSmallAnalystExact ? () => { hooks.scheduleAnalystZoomVisualRefresh(false) } : undefined,
    onZoomEnd: policy.useSmallAnalystExact ? () => { hooks.scheduleAnalystZoomVisualRefresh(false) } : undefined,
    onPointClick: (index) => {
      hooks.focusWorkPoint(index, false)
      hooks.exploreNodeClickHook?.(index)
    },
    onLinkClick: (index) => {
      hooks.focusWorkLink(index, false)
    },
    onBackgroundClick: () => {
      hooks.clearWorkFocus(false)
    },
  }
}
