import type { RepresentationVisualData } from '../../types'
import type { VisualAttributes } from '../../../ui-state/visual-attributes'
import { buildHueLookup } from './color-modes'
import { getNetwork, getStarfield, state } from './cache'
import { applyStarfieldAttributes } from './starfield'
import { applyNeonNetworkAttributes } from './style'

export function transformNeonNetworkPositions (data: RepresentationVisualData): Float32Array | null {
  const net = getNetwork()
  if (!net) return null
  if (data.nodeCount === net.nodeCount) return net.positions
  if (data.nodeCount < net.nodeCount) return null
  const stars = getStarfield(data.nodeCount)
  if (!stars) return null
  const out = new Float32Array(data.nodeCount * 2)
  out.set(net.positions, 0)
  // Truncate rather than throw if the starfield exceeds the engine's
  // capacity. Throwing here would leave the engine on its synthetic
  // random-walk positions for every node (visible as drifting blobs).
  const starCapacity = data.nodeCount - net.nodeCount
  const starsToCopy = Math.min(stars.count, starCapacity)
  out.set(stars.positions.subarray(0, starsToCopy * 2), net.nodeCount * 2)
  return out
}

export function transformNeonNetworkAttributes (
  data: RepresentationVisualData,
  attributes: VisualAttributes,
): void {
  const net = getNetwork()
  if (!net) {
    attributes.pointSizes.fill(0)
    return
  }
  applyNeonNetworkAttributes({
    attributes,
    network: net,
    photoMask: state.atlas?.photoMask,
    hueLookup: buildHueLookup(state.colorMode, net.eids, state.facets ?? undefined),
    starPalette: state.colorMode === 'hue',
  })
  if (data.nodeCount > net.nodeCount) {
    const stars = getStarfield(data.nodeCount)
    if (stars) applyStarfieldAttributes(attributes.pointColors, attributes.pointSizes, net.nodeCount, stars)
  }
}
