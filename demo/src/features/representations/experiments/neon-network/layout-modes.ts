import type { SlicedAttributes } from './attributes-loader'
import type { ColorMode, FacetColorMode } from './color-modes'
import { computeStragglerCount, pickStragglers, placeStragglers } from './layout-stragglers'
import type { LoadedNetwork } from './network-types'
import { GOLDEN_ANGLE, NULL_KEY, getRootIndex } from './shared'

const TWO_PI = Math.PI * 2

/**
 * Pick a secondary facet to sub-group an exploded cluster by. The primary
 * facet defines the cluster you clicked into; the secondary is the lens
 * we use to organise the people *inside* that cluster.
 *
 * Defaults are tuned for "what's the most informative next-level
 * breakdown" — e.g. once you're inside a market, industry is the natural
 * next question; inside an industry, seniority level is.
 */
export function pickSecondaryFacet (primary: ColorMode): FacetColorMode {
  switch (primary) {
    case 'markets': return 'industries'
    case 'industries': return 'levels'
    case 'levels': return 'functions'
    case 'functions': return 'industries'
    case 'companies': return 'levels'
    case 'hue': return 'industries'
  }
}

// Centroid ring radius as a fraction of the disc's max radius. 0.70
// gives clusters more breathing room around John than the prior 0.55,
// which had them crowding the centre.
const CENTROID_RADIUS_FACTOR = 0.70

// Packing density: each node "owns" roughly this many pixels squared.
// 150 is loose — the prior 90 packed dots into a perfect sunflower
// spiral that read as a single geometric shape rather than a
// community. 150 lets the texture of individual dots show through.
const BLOB_DENSITY = 150

// Inner/outer split: hop-1 packs in the inner half of each blob, hop-2 in
// the outer half. Preserves the "closer = more important" intuition even
// after the layout collapses the original concentric rings.
const HOP_SPLIT = 0.5

/**
 * Re-arrange the disc into cluster blobs — one circular cluster per facet
 * value. Cluster centroids sit on a ring around John (the root); each blob
 * is packed via golden-angle spiral. Within a blob, hop-1 nodes pack in
 * the inner half and hop-2 in the outer half.
 *
 * Returns null for `'hue'` mode (caller uses original positions).
 */
export function computeFacetLayout (
  mode: ColorMode,
  network: LoadedNetwork,
  facets: SlicedAttributes | undefined,
  originalPositions: Float32Array
): Float32Array | null {
  if (mode === 'hue' || !facets) return null
  const values = facets[mode]
  if (!values) return null

  const n = network.nodeCount
  const out = new Float32Array(n * 2)

  // Disc center is the root (hop=0). Fall back to world center if absent.
  const rootIdx = getRootIndex(network)
  let cx = 4096
  let cy = 4096
  let discMaxR = 0
  if (rootIdx >= 0) {
    cx = originalPositions[rootIdx * 2] as number
    cy = originalPositions[(rootIdx * 2) + 1] as number
  }
  // Measure the disc's outer radius from the original layout so cluster
  // centroids sit at a consistent fraction inside it.
  for (let i = 0; i < n; i += 1) {
    const dx = (originalPositions[i * 2] as number) - cx
    const dy = (originalPositions[(i * 2) + 1] as number) - cy
    const r = Math.sqrt((dx * dx) + (dy * dy))
    if (r > discMaxR) discMaxR = r
  }
  if (discMaxR === 0) discMaxR = 4000
  const centroidR = discMaxR * CENTROID_RADIUS_FACTOR

  if (rootIdx >= 0) {
    out[rootIdx * 2] = cx
    out[(rootIdx * 2) + 1] = cy
  }

  // Group non-root nodes by facet value. Nulls share one trailing bucket.
  const groups = new Map<string, number[]>()
  for (let i = 0; i < n; i += 1) {
    if (i === rootIdx) continue
    const v = values[i] ?? NULL_KEY
    const key = v || NULL_KEY
    let arr = groups.get(key)
    if (!arr) { arr = []; groups.set(key, arr) }
    arr.push(i)
  }
  // Largest first (matches palette order); nulls always last.
  const sorted = [...groups.entries()].sort((a, b) => {
    if (a[0] === NULL_KEY) return 1
    if (b[0] === NULL_KEY) return -1
    return b[1].length - a[1].length
  })

  // Allocate each cluster an angular slot whose width is proportional to
  // sqrt(count). This matches how blob radii scale, so the arc length
  // available at the centroid ring is always proportional to the blob's
  // diameter — adjacent clusters never collide regardless of how lopsided
  // the bucket sizes are. (Strictly proportional spans break for tiny
  // buckets: a 5-node cluster gets a 0.4° slot too narrow for any blob.)
  let sqrtSum = 0
  for (const [, group] of sorted) sqrtSum += Math.sqrt(group.length)
  let angleStart = -Math.PI / 2

  for (const [, group] of sorted) {
    const span = (Math.sqrt(group.length) / sqrtSum) * TWO_PI
    const centroidAngle = angleStart + (span * 0.5)
    const ccx = cx + (Math.cos(centroidAngle) * centroidR)
    const ccy = cy + (Math.sin(centroidAngle) * centroidR)
    // Cluster radius scales with sqrt(count) so area is proportional to
    // bucket count — gives the user an honest size signal across clusters.
    const blobR = Math.sqrt(group.length) * (BLOB_DENSITY / Math.sqrt(Math.PI))

    // Split this cluster's members by hop. hop1 goes inside, hop2 outside.
    const hop1: number[] = []
    const hop2: number[] = []
    for (const idx of group) {
      if (network.hops[idx] === 1) hop1.push(idx)
      else hop2.push(idx)
    }

    // Pull a few stragglers out of the cluster *before* we spiral the
    // rest. They get scattered in a loose ring outside the main blob
    // — breaks up the otherwise too-perfect sunflower edge and reads
    // as "this cluster has a couple of outliers / weak ties".
    const stragglerCount = computeStragglerCount(group.length)
    const seed = ((angleStart * 1000) | 0) ^ group.length
    const { hop1Members, hop2Members, stragglers } = pickStragglers(group, network, hop1, hop2, stragglerCount, seed)

    placeBlobRing(out, hop1Members, ccx, ccy, 0, blobR * HOP_SPLIT)
    placeBlobRing(out, hop2Members, ccx, ccy, blobR * HOP_SPLIT, blobR)
    placeStragglers(out, stragglers, ccx, ccy, blobR, seed)

    angleStart += span
  }

  return out
}


/**
 * Pack `members` into an annular blob around `(ccx, ccy)` with inner radius
 * `rInner` and outer radius `rOuter`, using a golden-angle spiral so the
 * fill density is roughly uniform.
 */
function placeBlobRing (
  out: Float32Array,
  members: number[],
  ccx: number,
  ccy: number,
  rInner: number,
  rOuter: number
): void {
  const count = members.length
  if (count === 0) return
  for (let j = 0; j < count; j += 1) {
    const t = (j + 0.5) / count
    // sqrt(t) so each ring of the spiral has roughly equal radial spacing.
    const r = Math.sqrt(t) * (rOuter - rInner) + rInner
    const theta = j * GOLDEN_ANGLE
    const idx = members[j] as number
    out[idx * 2] = ccx + (Math.cos(theta) * r)
    out[(idx * 2) + 1] = ccy + (Math.sin(theta) * r)
  }
}
