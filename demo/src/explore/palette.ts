/**
 * Coherent colour scheme for explore graphs. The demo's default
 * buildVisualAttributes() buckets node colour by screen angle, which on a
 * scattered layout reads as rainbow noise — these helpers replace it with
 * a vivid, meaningful scheme: one bright hue per major community, with the
 * long tail of tiny communities dimmed so it never becomes a clown party.
 */

const FOCUS: readonly [number, number, number] = [1.0, 0.82, 0.16]
const NEUTRAL: readonly [number, number, number] = [0.24, 0.66, 1.0]
/** Small / overflow communities collapse to this dim slate. */
const MUTED: readonly [number, number, number] = [0.34, 0.40, 0.54]

/** Vivid, well-separated hues for the largest communities. */
const COMMUNITY: ReadonlyArray<readonly [number, number, number]> = [
  [0.16, 0.62, 1.00], // electric blue
  [1.00, 0.46, 0.12], // vivid orange
  [0.18, 0.88, 0.46], // emerald
  [1.00, 0.24, 0.56], // magenta
  [0.64, 0.42, 1.00], // violet
  [0.06, 0.88, 0.90], // cyan
]

/** Flat RGBA — all neighbours a vivid azure, focus a bright gold. */
export function uniformColors (nodeCount: number): number[] {
  const out: number[] = []
  for (let i = 0; i < nodeCount; i += 1) {
    const c = i === 0 ? FOCUS : NEUTRAL
    out.push(c[0], c[1], c[2], i === 0 ? 1 : 0.95)
  }
  return out
}

/**
 * Flat RGBA — one vivid hue per major community (focus = index 0). Beyond
 * the palette size, communities share the muted slate so the picture stays
 * readable rather than turning into rainbow confetti.
 */
export function communityColors (
  labels: number[],
  ranks: Map<number, number>,
): number[] {
  const out: number[] = []
  for (let i = 0; i < labels.length; i += 1) {
    if (i === 0) {
      out.push(FOCUS[0], FOCUS[1], FOCUS[2], 1)
      continue
    }
    const rank = ranks.get(labels[i]!) ?? COMMUNITY.length
    const c = rank < COMMUNITY.length ? COMMUNITY[rank]! : MUTED
    out.push(c[0], c[1], c[2], 0.95)
  }
  return out
}
