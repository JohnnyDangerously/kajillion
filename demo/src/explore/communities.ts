/**
 * Community detection (label propagation) + a community-aware layout.
 * Used to settle a streamed ego-network into separated clusters once its
 * inter-neighbour mesh has loaded.
 */

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
/** Per-node adjacency cap for detection — sparsifies a dense mesh so
 *  label propagation separates instead of collapsing into one blob. */
const ADJ_CAP = 24

function hash01 (a: number, b: number): number {
  let x = Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 1, 0x85ebca77)
  x ^= x >>> 16
  x = Math.imul(x, 0x7feb352d)
  x ^= x >>> 15
  return (x >>> 0) / 0x1_0000_0000
}

/**
 * Label-propagation community detection over inter-neighbour edges.
 * Index 0 (the focus node) is excluded — it links to everything and would
 * otherwise collapse every cluster into one. Adjacency is capped and ties
 * are broken with a deterministic hash to resist dense-graph collapse.
 *
 * @param nodeCount total nodes including the focus at index 0
 * @param edges flat index pairs (the inter-neighbour mesh)
 * @returns community id per node index; index 0 is -1 (focus)
 */
export function detectCommunities (
  nodeCount: number,
  edges: number[],
  iterations = 6,
): number[] {
  const adj: number[][] = []
  for (let i = 0; i < nodeCount; i += 1) adj.push([])
  for (let e = 0; e + 1 < edges.length; e += 2) {
    const a = edges[e]!
    const b = edges[e + 1]!
    if (a === 0 || b === 0 || a === b) continue
    if (adj[a]!.length < ADJ_CAP) adj[a]!.push(b)
    if (adj[b]!.length < ADJ_CAP) adj[b]!.push(a)
  }

  const labels = new Array<number>(nodeCount)
  for (let i = 0; i < nodeCount; i += 1) labels[i] = i

  for (let it = 0; it < iterations; it += 1) {
    let changed = false
    for (let i = 1; i < nodeCount; i += 1) {
      const nbrs = adj[i]!
      if (nbrs.length === 0) continue
      const counts = new Map<number, number>()
      for (const n of nbrs) {
        const lab = labels[n]!
        counts.set(lab, (counts.get(lab) ?? 0) + 1)
      }
      let best = labels[i]!
      let bestScore = -1
      for (const [lab, c] of counts) {
        // Hash jitter < 1 only reorders genuine ties, never beats a higher count.
        const score = c + hash01(lab, i * 131 + it) * 0.9
        if (score > bestScore) {
          bestScore = score
          best = lab
        }
      }
      if (best !== labels[i]) {
        labels[i] = best
        changed = true
      }
    }
    if (!changed) break
  }
  labels[0] = -1
  return labels
}

/** Maps each community id to a rank (0 = largest community). */
export function rankCommunitiesBySize (labels: number[]): Map<number, number> {
  const sizes = new Map<number, number>()
  for (let i = 1; i < labels.length; i += 1) {
    const lab = labels[i]!
    sizes.set(lab, (sizes.get(lab) ?? 0) + 1)
  }
  const sorted = [...sizes.entries()].sort((a, b) => b[1] - a[1])
  const ranks = new Map<number, number>()
  sorted.forEach(([lab], i) => ranks.set(lab, i))
  return ranks
}

/**
 * Lays communities out as separated clusters evenly spaced on a ring
 * around the focus node (kept at centre). A single community collapses to
 * a centred disc — never an off-centre blob.
 *
 * @returns flat [x0, y0, ...] positions, index 0 = focus.
 */
export function communityLayout (
  labels: number[],
  ranks: Map<number, number>,
  spaceSize: number,
): number[] {
  const n = labels.length
  const center = spaceSize / 2
  const positions = new Array<number>(n * 2).fill(center)
  const count = Math.max(ranks.size, 1)
  const ringRadius = count > 1 ? spaceSize * 0.31 : 0

  const groups = new Map<number, number[]>()
  for (let i = 1; i < n; i += 1) {
    const lab = labels[i]!
    const list = groups.get(lab)
    if (list) list.push(i)
    else groups.set(lab, [i])
  }

  for (const [lab, members] of groups) {
    const rank = ranks.get(lab) ?? 0
    const theta = (rank / count) * Math.PI * 2
    const cx = center + ringRadius * Math.cos(theta)
    const cy = center + ringRadius * Math.sin(theta)
    const clusterRadius = Math.min(
      spaceSize * 0.17,
      spaceSize * 0.014 * Math.sqrt(members.length),
    )
    members.forEach((idx, mi) => {
      const frac = members.length > 1 ? mi / (members.length - 1) : 0
      const r = clusterRadius * Math.sqrt(frac)
      const a = mi * GOLDEN_ANGLE
      positions[idx * 2] = cx + r * Math.cos(a)
      positions[idx * 2 + 1] = cy + r * Math.sin(a)
    })
  }
  return positions
}
