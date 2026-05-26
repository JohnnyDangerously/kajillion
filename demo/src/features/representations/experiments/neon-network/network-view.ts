import type { LoadedNetwork } from './network-types'
import { GOLDEN_ANGLE, NULL_DISPLAY, NULL_KEY, getRootIndex } from './shared'

// Canvas spread for explode hubs. Bumped from 3800 → 5400 so hubs
// fan out across the full canvas instead of clumping into the centre
// 40% of it — user feedback on image #58 was "make this take up more
// space".
const CANVAS_RADIUS = 5400
// Member orbit around hub. Hubs sit further apart now (CANVAS_RADIUS
// up ~40%), so members get more orbit room too — keeps the
// hub-to-orbit ratio looking right.
const MAX_MEMBER_ORBIT = 980
const MEMBER_DENSITY = 56

// Minimum hub-spread radius — keeps the first hub a sane distance from
// John even when there's only one sub-cluster.
const MIN_HUB_R = 1200

export interface HubPlacement {
  /** The facet value identifying this hub (e.g. 'consulting'). */
  key: string;
  /** Display label for floating UI. */
  value: string;
  /** Node index whose position is the visual "hub" — highest-score
   *  member of the sub-cluster. */
  hubIdx: number;
  /** Other members of the sub-cluster (hubIdx excluded). */
  memberIndices: number[];
  /** Resolved hub world-space position after layout. */
  hubX: number;
  hubY: number;
}

export interface NetworkViewLayout {
  positions: Float32Array;
  hubs: HubPlacement[];
}

/**
 * Lay out one cluster as a "network view" — sub-cluster hubs spread
 * across the canvas, each with its members orbiting in a tight blob.
 * Returns the positions AND the hub metadata so callers can build
 * edges (hub → members) and place floating labels.
 *
 * `members` is the set of node indices in the clicked cluster.
 * `secondaryValues` gives each node its sub-cluster key (the next-level
 * facet). When `secondaryValues` is undefined or yields a single bucket
 * we fall back to one big golden-spiral spread of all members and
 * return zero hubs (the caller will skip edge/label rendering).
 */
export function buildNetworkView (
  network: LoadedNetwork,
  members: number[],
  secondaryValues: (string | null)[] | undefined,
  prevPositions: Float32Array,
  center: { x: number; y: number },
): NetworkViewLayout {
  const out = new Float32Array(prevPositions)
  if (members.length === 0) return { positions: out, hubs: [] }

  const cx = center.x
  const cy = center.y
  const rootIdx = getRootIndex(network)
  if (rootIdx >= 0 && members.includes(rootIdx)) {
    out[rootIdx * 2] = cx
    out[(rootIdx * 2) + 1] = cy
  }

  // Bucket members by their secondary-facet value. Skip root.
  const groups = new Map<string, number[]>()
  for (const idx of members) {
    if (idx === rootIdx) continue
    const v = secondaryValues?.[idx] ?? NULL_KEY
    const key = v || NULL_KEY
    let arr = groups.get(key)
    if (!arr) { arr = []; groups.set(key, arr) }
    arr.push(idx)
  }

  // Single-bucket case (no secondary data or all-same value): fall back
  // to one big spiral, return no hubs.
  if (groups.size <= 1) {
    const all = members.filter(i => i !== rootIdx)
    placeGoldenSpiral(out, all, network, cx, cy, CANVAS_RADIUS)
    return { positions: out, hubs: [] }
  }

  // Sort sub-clusters by member count desc; nulls last.
  const sorted = [...groups.entries()].sort((a, b) => {
    if (a[0] === NULL_KEY) return 1
    if (b[0] === NULL_KEY) return -1
    return b[1].length - a[1].length
  })

  // Place hubs on a golden spiral filling the canvas. sqrt(t) keeps the
  // outermost hubs from clustering at the rim.
  const hubs: HubPlacement[] = []
  const total = sorted.length
  for (let i = 0; i < total; i += 1) {
    const [key, groupMembers] = sorted[i]!
    // Highest-score member becomes the visual hub.
    const ranked = [...groupMembers].sort((a, b) =>
      (network.scores[b] ?? 0) - (network.scores[a] ?? 0))
    const hubIdx = ranked[0] as number
    const tail = ranked.slice(1)

    const t = (i + 0.5) / total
    // Bias toward the outside a bit (linear blend) so the inner area
    // doesn't pile up while outer hubs feel sparse.
    const r = Math.max(MIN_HUB_R, Math.sqrt(t) * CANVAS_RADIUS)
    // Offset rotation so the first (biggest) hub doesn't always land at
    // the same angle.
    const theta = (i * GOLDEN_ANGLE) - (Math.PI / 2)
    const hubX = cx + (Math.cos(theta) * r)
    const hubY = cy + (Math.sin(theta) * r)
    out[hubIdx * 2] = hubX
    out[(hubIdx * 2) + 1] = hubY

    // Orbit the rest of this sub-cluster around the hub.
    const orbitR = Math.min(MAX_MEMBER_ORBIT, Math.sqrt(tail.length) * MEMBER_DENSITY)
    for (let j = 0; j < tail.length; j += 1) {
      const tj = (j + 0.5) / Math.max(tail.length, 1)
      const rj = Math.sqrt(tj) * orbitR
      const thj = j * GOLDEN_ANGLE
      const m = tail[j] as number
      out[m * 2] = hubX + (Math.cos(thj) * rj)
      out[(m * 2) + 1] = hubY + (Math.sin(thj) * rj)
    }

    hubs.push({
      key,
      value: key === NULL_KEY ? NULL_DISPLAY : key,
      hubIdx,
      memberIndices: tail,
      hubX,
      hubY,
    })
  }

  return { positions: out, hubs }
}

/** Build hub→member spoke edges as the flat [src, dst, src, dst, …]
 *  Float32Array that Cosmos's setLinks expects. */
export function buildHubSpokes (hubs: HubPlacement[]): Float32Array {
  let count = 0
  for (const h of hubs) count += h.memberIndices.length
  const out = new Float32Array(count * 2)
  let w = 0
  for (const h of hubs) {
    for (const m of h.memberIndices) {
      out[w] = h.hubIdx; out[w + 1] = m
      w += 2
    }
  }
  return out
}

function placeGoldenSpiral (
  out: Float32Array,
  members: number[],
  network: LoadedNetwork,
  cx: number,
  cy: number,
  radius: number,
): void {
  const ranked = [...members].sort((a, b) =>
    (network.scores[b] ?? 0) - (network.scores[a] ?? 0))
  const n = ranked.length
  for (let j = 0; j < n; j += 1) {
    const t = (j + 0.5) / n
    const r = Math.sqrt(t) * radius
    const theta = j * GOLDEN_ANGLE
    const idx = ranked[j] as number
    out[idx * 2] = cx + (Math.cos(theta) * r)
    out[(idx * 2) + 1] = cy + (Math.sin(theta) * r)
  }
}
