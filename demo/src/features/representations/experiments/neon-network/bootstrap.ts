import type { RepresentationInstallContext } from '../../types'
import { loadAttributesManifest, sliceByRenderIndex } from './attributes-loader'
import { loadNetworkAtlas } from './atlas-loader'
import { getNetwork, getStarfield, state } from './cache'
import { loadNamesManifest } from './names-loader'
import { getRootCenter, isLightTheme } from './shared'

export async function bootstrapNeonNetwork (
  ctx: RepresentationInstallContext,
  isCancelled: () => boolean,
): Promise<void> {
  const net = await Promise.resolve(getNetwork() ?? state.networkPromise)
  if (isCancelled()) return
  state.network = net ?? null
  if (net) applyLoadedPositions(ctx, net)
  fitInitialCamera(ctx)
  await loadAtlasAndFacets(ctx, isCancelled)
}

function applyLoadedPositions (
  ctx: RepresentationInstallContext,
  net: NonNullable<typeof state.network>,
): void {
  let positions: Float32Array | null = null
  if (ctx.data.nodeCount === net.nodeCount) positions = net.positions
  else if (ctx.data.nodeCount > net.nodeCount) positions = buildCombinedPositions(ctx, net)
  if (!positions) return
  ctx.data.positions = positions
  ctx.graph.setPointPositions(positions, true)
}

function buildCombinedPositions (
  ctx: RepresentationInstallContext,
  net: NonNullable<typeof state.network>,
): Float32Array {
  // Always return a sized-up array so the engine's pointsNumber matches
  // ctx.data.nodeCount (a length mismatch makes the engine paint every
  // dot with pointDefaultColor on the next colour refresh).
  const positions = new Float32Array(ctx.data.nodeCount * 2)
  positions.set(net.positions, 0)
  const stars = getStarfield(ctx.data.nodeCount)
  if (!stars) {
    // Light theme (or anywhere starfield is suppressed). Leave the
    // trailing slots at (0,0); their point sizes are 0 too so they're
    // invisible — they only exist to keep the engine's buffers sized
    // consistently with ctx.data.nodeCount.
    return positions
  }
  const starCapacity = ctx.data.nodeCount - net.nodeCount
  const starsToCopy = Math.min(stars.count, starCapacity)
  positions.set(stars.positions.subarray(0, starsToCopy * 2), net.nodeCount * 2)
  if (stars.count > starCapacity) {
    console.warn(`[neon-network] starfield (${stars.count}) exceeds engine capacity ${starCapacity}; truncating. Bump REP_NODE_COUNT_DEFAULT.`)
  }
  return positions
}

function fitInitialCamera (ctx: RepresentationInstallContext): void {
  const net = state.network
  if (!net) {
    ctx.graph.setZoomTransformByPointPositions(new Float32Array(ctx.data.positions), 0, undefined, 0.04, false)
    return
  }
  const { x: cx, y: cy } = getRootCenter(net)
  // Light theme has no halo/field, so the disc should fill the
  // canvas. Use the actual outer radius + a tight margin (~6%) so
  // the disc reads as the entire view. Dark theme keeps the wider
  // 6800 box so halo + ambient field have room to breathe.
  const fitRadius = isLightTheme() ? Math.max(800, net.outerRadius * 1.06) : 6800
  const box = new Float32Array([cx - fitRadius, cy - fitRadius, cx + fitRadius, cy + fitRadius])
  ctx.graph.setZoomTransformByPointPositions(box, 0, undefined, 0.04, false)
}

async function loadAtlasAndFacets (
  ctx: RepresentationInstallContext,
  isCancelled: () => boolean,
): Promise<void> {
  const atlas = await loadNetworkAtlas(ctx.data.nodeCount)
  if (isCancelled()) return
  if (atlas) {
    state.atlas = atlas
    ctx.graph.setImageData(atlas.images)
    ctx.graph.setPointImageIndices(atlas.imageIndices)
  }
  if (!state.facets && state.network) {
    const manifest = await loadAttributesManifest()
    if (isCancelled()) return
    if (manifest) state.facets = sliceByRenderIndex(manifest, state.network.eids)
  }
  if (!state.names && state.network) {
    const namesArr = await loadNamesManifest()
    if (isCancelled()) return
    if (namesArr && namesArr.length === state.network.nodeCount) state.names = namesArr
  }
}
