import type { LoadedNetwork } from './network-types'
import { GOLDEN_ANGLE } from './shared'

// World-space layout knobs for the cluster portrait.
// We want a single sub-cluster spread out enough that each face is
// readable and edges can route between them without crossing the
// canvas. Tuned for 20-60 members; bigger groups get tighter packing.
const PORTRAIT_RADIUS = 2200
const MIN_RADIUS = 600

// Per-face sizes for portrait close-up. Bigger than atlas-view dots
// but well under the explode-mode maxPointSizeOverride lift.
const SIZE_FACE = 180

/**
 * Maximum number of members to surface in a portrait. The CSR
 * `neighbors_batch` limit is what bounds edges; this bounds the
 * visible faces. 60 gives a "fully populated workspace" feel without
 * the canvas becoming unreadable. For sub-clusters larger than this,
 * we pick top-N by score.
 */
export const PORTRAIT_MAX_MEMBERS = 60

export interface PortraitClusterLayout {
  positions: Float32Array;
  sizes: Float32Array;
  /** Resolved per-face world positions in the order they were placed,
   *  with member idx for label/drag lookups. */
  faces: Array<{ idx: number; x: number; y: number }>;
}

/**
 * Lay out a sub-cluster as a portrait spread: members arranged on a
 * golden-angle spiral centred on the cluster's natural focal point,
 * sized to be readable up close. Returns positions, sizes, and a
 * sorted faces array for label / drag wiring.
 *
 * `members` should already be capped at PORTRAIT_MAX_MEMBERS by the
 * caller (pick top-by-score before passing).
 */
export function buildPortraitClusterLayout (
  network: LoadedNetwork,
  members: number[],
  prevPositions: Float32Array,
  center: { x: number; y: number },
): PortraitClusterLayout {
  const positions = new Float32Array(prevPositions)
  // CRITICAL: size to the ENGINE'S pointCount (positions / 2), not
  // network.nodeCount. The engine has ctx.data.nodeCount slots
  // (~19,500 including starfield/halo); a 5,157-long sizes array
  // triggers createNumericValues' length-mismatch fallback which
  // fills *every* slot with pointDefaultSize — making every
  // non-portrait dot reappear at default size and ruining the
  // drill-in view. (Same bug class as the cluster-mode colour reset
  // we fixed earlier.)
  const sizes = new Float32Array(positions.length / 2)
  const faces: Array<{ idx: number; x: number; y: number }> = []
  if (members.length === 0) return { positions, sizes, faces }

  // Highest-score → centre, others spiral outward. Gives the eye a
  // natural focal point and ensures the most "important" person sits
  // somewhere readable rather than buried in the rim.
  const ranked = [...members].sort((a, b) =>
    (network.scores[b] ?? 0) - (network.scores[a] ?? 0))

  // Scale radius with sqrt(count) so 20 nodes feel sparse and 60 feel
  // packed but not crammed. Clamp to a minimum so a tiny sub-cluster
  // doesn't collapse to a dot.
  const radius = Math.max(MIN_RADIUS, Math.sqrt(ranked.length / 60) * PORTRAIT_RADIUS)

  const cx = center.x
  const cy = center.y
  for (let j = 0; j < ranked.length; j += 1) {
    const t = (j + 0.5) / ranked.length
    const r = Math.sqrt(t) * radius
    const theta = j * GOLDEN_ANGLE
    const idx = ranked[j] as number
    const x = cx + (Math.cos(theta) * r)
    const y = cy + (Math.sin(theta) * r)
    positions[idx * 2] = x
    positions[(idx * 2) + 1] = y
    sizes[idx] = SIZE_FACE
    faces.push({ idx, x, y })
  }
  return { positions, sizes, faces }
}

/** Pick top-N members of a sub-cluster by CSR score. */
export function pickPortraitMembers (
  network: LoadedNetwork,
  allMembers: number[],
  max: number = PORTRAIT_MAX_MEMBERS,
): number[] {
  if (allMembers.length <= max) return [...allMembers]
  return [...allMembers]
    .sort((a, b) => (network.scores[b] ?? 0) - (network.scores[a] ?? 0))
    .slice(0, max)
}
