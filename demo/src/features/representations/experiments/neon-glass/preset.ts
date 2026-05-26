import type { GraphConfig } from '@kajillion/graph'
import type { DemoConfig } from '../../../control-plane/types'
import { runBloomAnimation } from './bloom-animation'
import { installBloomControls } from './bloom-controls'
import { resolveBloomVariant, type BloomVariant } from './bloom-variants'
import { loadAndSliceHeadshotAtlas } from './headshot-loader'
import { concentricRingPositions } from './layout'
import { applyNeonGlassAttributes } from './style'
import type {
  RepresentationInstallContext,
  RepresentationPreset,
  RepresentationVisualData,
} from '../../types'
import type { VisualAttributes } from '../../../ui-state/visual-attributes'

export const neonGlassPreset: RepresentationPreset = {
  id: 'neon-glass',
  ownsCamera: true,
  applyGraphConfig (config: GraphConfig, cfg: DemoConfig): GraphConfig {
    const isLight = cfg.theme === 'light'
    return {
      ...config,
      backgroundColor: isLight ? '#f4f6fb' : '#000000',
      pointDefaultColor: isLight ? '#1d2a4a' : '#6aa6ff',
      // World-unit size, multiplied by camera zoom × pixel ratio at render
      // time. With scalePointsOnZoom + fit-view zoom ~0.07 this gives a
      // ~45 css-px dot at default — already showing a face. Zooming in
      // scales linearly until the cap below kicks in.
      pointDefaultSize: 320,
      // Cap rendered dots at ~160 css px (320 device px / pixel ratio 2).
      // Lifts Cosmos's 64-px artistic cap but stops well before a single
      // face fills the viewport — keeps a comfortable "several faces
      // visible" experience at max zoom.
      maxPointSizeOverride: 320,
      pointSizeScale: 1,
      // Scale points with camera zoom so zooming in actually grows the
      // photos. Cosmos's default is false (fixed-screen-px dots, like
      // labels). For a photo wall we want camera-relative sizing.
      scalePointsOnZoom: true,
      pointOpacity: 1,
      renderLinks: false,
      linkOpacity: 0,
      enableSimulation: false,
      // Camera owned by the preset. We disable fitViewOnInit because the
      // bloom collapses positions to centre AFTER Cosmos schedules its
      // fit-view (via setTimeout) — so the auto-fit would race and lock
      // the camera to a single point. Instead, the install hook calls
      // setZoomTransformByPointPositions on the FINAL disc bounds before
      // snapping to centre, so the camera is correctly framed for the
      // bloom destination.
      fitViewOnInit: false,
      fitViewPadding: 0.01,
      fitViewDuration: 200,
      constrainCameraToGraph: true,
      cameraBoundsPadding: 0.02,
      // Kill the atmospheric depth-cue halos so dots read as crisp circles
      // instead of soft glow blobs.
      pointDepthCueStrength: 0,
      pointDepthCueSize: 0,
      pointDepthCueBrightness: 0,
      pointDepthCueOpacity: 0,
      pointDepthCueMoat: 0,
      pointDepthCueHighlight: 0,
      pointDepthCueShadow: 0,
      pointDepthCueSaturation: 0,
      // Maximum AA for crisp small dots. Force a high pixel ratio so dot
      // edges sample finely even on dpr=1 displays.
      msaa: 4,
      adaptivePixelRatio: false,
      pixelRatio: Math.max(2, window.devicePixelRatio || 1),
      // Disable tile/LOD compensation that can pop dot sizes inconsistently.
      pointTileBudget: 0,
      pointMinPixelSize: 0,
      linkMinPixelLength: 0,
    }
  },
  transformPositions (data: RepresentationVisualData, cfg: DemoConfig): Float32Array {
    return concentricRingPositions(data.nodeCount, cfg.seed || 1)
  },
  transformAttributes (
    data: RepresentationVisualData,
    attributes: VisualAttributes,
    cfg: DemoConfig
  ): void {
    applyNeonGlassAttributes(data, attributes, cfg)
  },
  install (ctx: RepresentationInstallContext): () => void {
    // Hide work-mode cluster labels — neon-glass is a self-contained art
    // piece; the MARKETING/SUCCESS/etc. labels belong to the analyst view.
    // CSS rule rather than per-element `display:none` so future labels
    // (created by the on-demand label-overlay) are also hidden.
    const labelStyle = document.createElement('style')
    labelStyle.dataset.repHide = 'neon-glass'
    labelStyle.textContent = '.cluster-label { display: none !important; }'
    document.head.appendChild(labelStyle)

    // Frame the camera on the final disc bounds immediately so the user
    // sees the framing right away, before the bloom starts.
    const finalPositions = new Float32Array(ctx.data.positions)
    ctx.graph.setZoomTransformByPointPositions(finalPositions, 0, undefined, 0.05, false)

    // Snapshot the per-node sizes set by the style pipeline BEFORE we
    // zero them — these are the targets the bloom restores to.
    const finalSizes = new Float32Array(ctx.graph.getPointSizes())
    // Pre-hide every point so we don't flash a static disc while the
    // atlas loads. Bloom restores sizes ring by ring.
    ctx.graph.setPointSizes(new Float32Array(ctx.data.nodeCount))
    ctx.graph.render()

    let cancelled = false
    let cancelBloom: (() => void) | null = null
    let photosReady = false

    const playBloom = (variant: BloomVariant): void => {
      cancelBloom?.()
      // Re-zero sizes so the new variant starts from the same baseline.
      ctx.graph.setPointSizes(new Float32Array(ctx.data.nodeCount))
      ctx.graph.render()
      cancelBloom = runBloomAnimation(ctx.graph, finalPositions, finalSizes, { variant })
    }

    // Initial variant from URL; default 'pop'. The bar will let the user
    // override it live without reloading.
    const initialVariant = resolveBloomVariant(
      new URLSearchParams(window.location.search).get('anim')
    )
    let activeVariant = initialVariant

    const removeControls = installBloomControls(initialVariant, (v) => {
      activeVariant = v
      if (photosReady) playBloom(v)
    })

    void loadAndSliceHeadshotAtlas(ctx.data.nodeCount).then((sliced) => {
      if (cancelled) return
      if (sliced) {
        ctx.graph.setImageData(sliced.images)
        ctx.graph.setPointImageIndices(sliced.imageIndices)
      }
      photosReady = true
      playBloom(activeVariant)
    })
    return () => {
      cancelled = true
      cancelBloom?.()
      labelStyle.remove()
      removeControls()
    }
  },
}
