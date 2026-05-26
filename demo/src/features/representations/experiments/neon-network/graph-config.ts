import type { GraphConfig } from '@kajillion/graph'
import type { DemoConfig } from '../../../control-plane/types'

export function applyNeonNetworkGraphConfig (config: GraphConfig, cfg: DemoConfig): GraphConfig {
  const isLight = cfg.theme === 'light'
  return {
    ...config,
    backgroundColor: isLight ? '#f4f6fb' : '#000000',
    pointDefaultColor: isLight ? '#1d2a4a' : '#7da6ff',
    pointDefaultSize: 60,
    maxPointSizeOverride: 160,
    pointSizeScale: 1,
    scalePointsOnZoom: true,
    pointOpacity: 1,
    // Kill the dark border ring around each dot. Default (1 = black
    // outline) added a hard rim that, at small zoom, averaged with
    // the orange fill and made the entire disc look burnt brown.
    // 0 = no border, pure HSL fill comes through.
    pointBorderTreatment: 0,
    renderLinks: true,
    // Edges share the disc's warm tint instead of fighting it with
    // gray. Warm gold for light theme (visible against white but
    // matches the disc's palette range); slate-warm for dark theme.
    linkDefaultColor: isLight ? '#d49a4f' : '#8b6f3a',
    linkDefaultWidth: 1.4,
    linkOpacity: 0,
    curvedLinks: true,
    curvedLinkWeight: 0.6,
    curvedLinkControlPointDistance: 0.35,
    curvedLinkSegments: 16,
    linkVisibilityDistanceRange: [0, 12000],
    linkVisibilityMinTransparency: 1,
    enableSimulation: false,
    fitViewOnInit: false,
    fitViewPadding: 0.02,
    fitViewDuration: 200,
    constrainCameraToGraph: true,
    cameraBoundsPadding: 0.04,
    pointDepthCueStrength: 0,
    pointDepthCueSize: 0,
    pointDepthCueBrightness: 0,
    pointDepthCueOpacity: 0,
    pointDepthCueMoat: 0,
    pointDepthCueHighlight: 0,
    pointDepthCueShadow: 0,
    pointDepthCueSaturation: 0,
    msaa: 4,
    adaptivePixelRatio: false,
    pixelRatio: Math.max(2, window.devicePixelRatio || 1),
    pointTileBudget: 0,
    pointMinPixelSize: 0,
    linkMinPixelLength: 0,
  }
}
