export const SEED = 0x9E3779B9

// Halo geometry — many concentric rings that smoothly fade from the
// disc's edge into the ambient field. Each ring is one disc-ring
// spacing past the previous. The first few rings match the disc's
// cadence exactly (indistinguishable continuation); subsequent rings
// progressively thin out (lower fill probability + smaller dots),
// blurring the boundary between "disc" and "space" so there's no
// abrupt transition anywhere.
//
//   HALO_RING_RADIAL_GAP (20) — radial step between rings; matches
//     the disc's outer band cadence.
//   HALO_SLOT_SPACING (450) — arc-length between dots within a ring;
//     matches the disc's outer ring dot spacing.
//   HALO_INNER_OFFSET (20) — distance from disc rim to ring 1.
//   N_HALO_RINGS (22) — how many rings extend outward. Lots of rings
//     = long fade-out before the ambient field takes over.
//   HALO_FULL_RINGS (3) — rings 0..N stay at 100% fill.
//   HALO_FILL_DECAY (0.90) — multiplier per ring after the full band.
//     Slow decay (0.90 vs 0.5) means the thinning is gradual and
//     reads as a smooth fade rather than a hard cutoff.
//   HALO_SIZE_START_RING (4) — dot size stays at RING_NODE_SIZE for
//     the first N rings, then shrinks linearly toward HALO_MIN_SIZE.
// All three spacings = 100 to match the disc's uniformly-packed
// cadence (network-loader re-packs hop-2 at 100×100, matching hop-1's
// natural density). The halo continues that exact rhythm outward:
// first ring sits one disc-spacing past the rim, dots one disc-
// spacing apart along the circumference, rings one disc-spacing
// apart radially. Rings 0–2 are indistinguishable from disc rings;
// from ring 3 outward fill + size decay so the disc fades into space.
export const HALO_RING_RADIAL_GAP = 100
export const HALO_SLOT_SPACING = 100
export const HALO_INNER_OFFSET = 100
export const N_HALO_RINGS = 12
export const HALO_FULL_RINGS = 3
export const HALO_FILL_DECAY = 0.88
export const HALO_SIZE_START_RING = 3

export const RING_NODE_SIZE = 56
export const HALO_MIN_SIZE = 22
export const FIELD_INNER_PAD = 0
export const FIELD_OUTER_R = 60_000
export const FIELD_COUNT = 10_000
export const FIELD_SIZE_MIN = 16
export const FIELD_SIZE_MAX = 34
export const GIANT_COUNT = 800
export const GIANT_SIZE_MIN = 42
export const GIANT_SIZE_MAX = 78
export const HALO_ALPHA = 1.0
export const FIELD_ALPHA = 1.0

export const STAR_PALETTE: ReadonlyArray<readonly [number, number, number]> = [
  [1.00, 1.00, 1.00],
  [1.00, 1.00, 1.00],
  [0.94, 0.97, 1.00],
  [0.85, 0.91, 1.00],
  [1.00, 0.97, 0.91],
]

export function makeRand (seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x9E3779B9) >>> 0
    let z = state
    z = ((z ^ (z >>> 16)) * 0x85ebca6b) >>> 0
    z = ((z ^ (z >>> 13)) * 0xc2b2ae35) >>> 0
    return ((z ^ (z >>> 16)) >>> 0) / 0x100000000
  }
}
