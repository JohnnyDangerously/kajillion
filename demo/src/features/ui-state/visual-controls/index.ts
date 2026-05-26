import { type Graph, type GraphConfig } from '@kajillion/graph'
import { readControls } from '../../control-plane/controls'
import { syncTuningLabels } from '../../control-plane/depth-presets'
import type { ControlElements } from '../../control-plane/dom'
import type { DemoConfig } from '../../control-plane/types'
import type { GeneratedGraph } from '../../../generate-graph'
import type { VisualAttributeApplyOptions } from '../frame-visuals'

export {
  createAnalystZoomVisualRefreshScheduler,
  type AnalystZoomVisualRefreshScheduler,
} from './analyst-zoom-visual-refresh'

interface VisualControlsControllerOptions {
  ctlEl: ControlElements;
  getCurrentConfig: () => DemoConfig;
  setCurrentConfig: (config: DemoConfig) => void;
  getCurrentGraph: () => Graph | null;
  getCurrentData: () => GeneratedGraph | null;
  buildGraphConfig: (config: DemoConfig) => GraphConfig;
  applyCurrentVisualAttributes: (
    graph: Graph,
    data: GeneratedGraph,
    options?: VisualAttributeApplyOptions
  ) => void;
  applyTheme: (theme: DemoConfig['theme']) => void;
  syncToggleButtons: () => void;
  applyControlChange: () => Promise<void>;
  updateWorkFocusPanel: () => void;
}

export interface VisualControlsController {
  applyVisualControls: () => void;
  scheduleVisualControls: () => void;
}

export function createVisualControlsController (
  options: VisualControlsControllerOptions
): VisualControlsController {
  let visualControlFrame = 0

  const applyVisualControls = (): void => {
    const currentConfig = readControls(options.ctlEl)
    options.setCurrentConfig(currentConfig)
    options.syncToggleButtons()
    syncTuningLabels(options.ctlEl)
    options.applyTheme(currentConfig.theme)
    const graph = options.getCurrentGraph()
    const data = options.getCurrentData()
    if (!graph || !data) {
      options.applyControlChange().catch(err => console.error(err))
      return
    }

    const graphConfig = options.buildGraphConfig(currentConfig)
    graph.setConfigPartial({
      backgroundColor: graphConfig.backgroundColor,
      pointDefaultColor: graphConfig.pointDefaultColor,
      pointOpacity: graphConfig.pointOpacity,
      pointSizeScale: graphConfig.pointSizeScale,
      pointGreyoutOpacity: graphConfig.pointGreyoutOpacity,
      outlinedPointRingColor: graphConfig.outlinedPointRingColor,
      linkDefaultColor: graphConfig.linkDefaultColor,
      linkDefaultWidth: graphConfig.linkDefaultWidth,
      linkWidthScale: graphConfig.linkWidthScale,
      linkOpacity: graphConfig.linkOpacity,
      linkGreyoutOpacity: graphConfig.linkGreyoutOpacity,
      renderLinks: graphConfig.renderLinks,
      linkBlendMode: graphConfig.linkBlendMode,
      renderLodMode: graphConfig.renderLodMode,
      impostorDensityScale: graphConfig.impostorDensityScale,
      impostorTileSize: graphConfig.impostorTileSize,
      impostorMicroSplats: graphConfig.impostorMicroSplats,
      impostorTileOpacity: graphConfig.impostorTileOpacity,
      impostorExactOverlay: graphConfig.impostorExactOverlay,
      impostorExactOverlaySampleRate: graphConfig.impostorExactOverlaySampleRate,
      impostorExactOverlayOpacity: graphConfig.impostorExactOverlayOpacity,
      impostorExactOverlaySizeScale: graphConfig.impostorExactOverlaySizeScale,
      impostorSparseTileThreshold: graphConfig.impostorSparseTileThreshold,
      impostorSparseAnchorOpacity: graphConfig.impostorSparseAnchorOpacity,
      impostorAnchorsPerTile: graphConfig.impostorAnchorsPerTile,
      impostorPointSizeScale: graphConfig.impostorPointSizeScale,
      impostorCompositeStrength: graphConfig.impostorCompositeStrength,
      impostorMassRadiusScale: graphConfig.impostorMassRadiusScale,
      impostorMassThreshold: graphConfig.impostorMassThreshold,
      impostorMassMaxAlpha: graphConfig.impostorMassMaxAlpha,
      impostorMassColorBoost: graphConfig.impostorMassColorBoost,
      impostorMassExtrusion: graphConfig.impostorMassExtrusion,
      impostorAutoMinPoints: graphConfig.impostorAutoMinPoints,
      linkMinPixelLength: graphConfig.linkMinPixelLength,
      pointMinPixelSize: graphConfig.pointMinPixelSize,
      pointLodStrength: graphConfig.pointLodStrength,
      pointLodZoomRange: graphConfig.pointLodZoomRange,
      pointLodMinSampleRate: graphConfig.pointLodMinSampleRate,
      pointLodSizeCompensation: graphConfig.pointLodSizeCompensation,
      pointLodOpacityCompensation: graphConfig.pointLodOpacityCompensation,
      pointTileBudget: graphConfig.pointTileBudget,
      pointTileBudgetSize: graphConfig.pointTileBudgetSize,
      pointTileBudgetMaxScale: graphConfig.pointTileBudgetMaxScale,
      pointDepthCueStrength: graphConfig.pointDepthCueStrength,
      pointDepthCueSize: graphConfig.pointDepthCueSize,
      pointDepthCueBrightness: graphConfig.pointDepthCueBrightness,
      pointDepthCueOpacity: graphConfig.pointDepthCueOpacity,
      pointDepthCueMoat: graphConfig.pointDepthCueMoat,
      pointDepthCueHighlight: graphConfig.pointDepthCueHighlight,
      pointDepthCueShadow: graphConfig.pointDepthCueShadow,
      pointDepthCueSaturation: graphConfig.pointDepthCueSaturation,
      pointBorderTreatment: graphConfig.pointBorderTreatment,
      linkLodStrength: graphConfig.linkLodStrength,
      linkLodZoomRange: graphConfig.linkLodZoomRange,
      linkLodMinSampleRate: graphConfig.linkLodMinSampleRate,
      linkLodWidthCompensation: graphConfig.linkLodWidthCompensation,
      linkLodOpacityCompensation: graphConfig.linkLodOpacityCompensation,
      curvedLinks: graphConfig.curvedLinks,
      curvedLinkSegments: graphConfig.curvedLinkSegments,
      curvedLinkWeight: graphConfig.curvedLinkWeight,
      curvedLinkControlPointDistance: graphConfig.curvedLinkControlPointDistance,
      linkBundlingStrength: graphConfig.linkBundlingStrength,
      linkBundlingCellSize: graphConfig.linkBundlingCellSize,
      enableDrag: graphConfig.enableDrag,
    })
    options.applyCurrentVisualAttributes(graph, data)
    options.updateWorkFocusPanel()
    graph.render()
  }

  const scheduleVisualControls = (): void => {
    if (visualControlFrame) return
    visualControlFrame = requestAnimationFrame(() => {
      visualControlFrame = 0
      applyVisualControls()
    })
  }

  return {
    applyVisualControls,
    scheduleVisualControls,
  }
}
