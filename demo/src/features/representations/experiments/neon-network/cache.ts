import type { VisualAttributes } from '../../../ui-state/visual-attributes'
import type { SlicedAttributes } from './attributes-loader'
import type { LoadedNetworkAtlas } from './atlas-loader'
import { buildHueLookup, type ColorMode } from './color-modes'
import { loadNetwork } from './network-loader'
import type { LoadedNetwork } from './network-types'
import { isLightTheme } from './shared'
import { applyStarfieldAttributes, generateStarfield, type StarfieldData } from './starfield'
import { applyNeonNetworkAttributes } from './style'

export const state: {
  networkPromise: ReturnType<typeof loadNetwork> | null;
  network: LoadedNetwork | null;
  atlas: LoadedNetworkAtlas | null;
  facets: SlicedAttributes | null;
  names: string[] | null;
  starfield: StarfieldData | null;
  colorMode: ColorMode;
} = {
  networkPromise: null,
  network: null,
  atlas: null,
  facets: null,
  names: null,
  starfield: null,
  colorMode: 'hue',
}

export function getNetwork (): LoadedNetwork | null {
  if (state.network) return state.network
  if (!state.networkPromise) state.networkPromise = loadNetwork()
  return null
}

export function getStarfield (totalNodeCount: number): StarfieldData | null {
  const net = state.network
  if (!net || totalNodeCount <= net.nodeCount) return null
  // Light theme is a "presentation" mode: white background, just disc
  // + clusters. The halo + ambient field would look like noise on
  // white, so we don't generate them at all.
  if (isLightTheme()) return null
  if (!state.starfield) {
    state.starfield = generateStarfield({
      discOuterR: net.outerRadius,
      centerX: 4096,
      centerY: 4096,
    })
  }
  return state.starfield
}

export function buildTargetAttributes (nodeCount: number): { colors: Float32Array; sizes: Float32Array } {
  const colors = new Float32Array(nodeCount * 4)
  const sizes = new Float32Array(nodeCount)
  const net = state.network
  if (!net) return { colors, sizes }
  const visual: VisualAttributes = {
    pointColors: colors,
    pointSizes: sizes,
    pointShapes: new Float32Array(nodeCount),
    linkColors: new Float32Array(0),
    linkWidths: new Float32Array(0),
  }
  applyNeonNetworkAttributes({
    attributes: visual,
    network: net,
    photoMask: state.atlas?.photoMask,
    hueLookup: buildHueLookup(state.colorMode, net.eids, state.facets ?? undefined),
    starPalette: state.colorMode === 'hue',
  })
  const stars = getStarfield(nodeCount)
  if (stars) applyStarfieldAttributes(colors, sizes, net.nodeCount, stars)
  return { colors, sizes }
}
