// Decorative halo + ambient star field around the disc.
//
// HALO — 4 concentric rings of dots that read as more rings of the
// actual disc. Sized identically to disc nodes and placed at the
// disc's own ring spacing past the outer edge, so the seam is
// invisible (rings 1 + 2 should be indistinguishable from real
// hop-2 outer rings). Rings 3 + 4 thin out progressively.
//
// FIELD — a wide, dense scatter of bright stars + bright giants
// extending far past any plausible zoom-out distance. Uniform-area
// distribution within a large disc means density looks the same
// regardless of how far the user pulls back: no visible box edge.
//
// Palette: white / off-white / soft blue, matching the disc.

import {
  FIELD_ALPHA,
  FIELD_COUNT,
  FIELD_INNER_PAD,
  FIELD_OUTER_R,
  FIELD_SIZE_MAX,
  FIELD_SIZE_MIN,
  GIANT_COUNT,
  GIANT_SIZE_MAX,
  GIANT_SIZE_MIN,
  HALO_ALPHA,
  HALO_FILL_DECAY,
  HALO_FULL_RINGS,
  HALO_INNER_OFFSET,
  HALO_MIN_SIZE,
  HALO_RING_RADIAL_GAP,
  HALO_SIZE_START_RING,
  HALO_SLOT_SPACING,
  N_HALO_RINGS,
  RING_NODE_SIZE,
  SEED,
  STAR_PALETTE,
  makeRand,
} from './starfield-config'
import { packStarfieldData, type StarPoint, type StarfieldData } from './starfield-data'

export type { StarfieldData } from './starfield-data'

export interface StarfieldGeometry {
  /** Outer radius of the actual disc (max distance of any bin node
   *  from the centre). Halo rings start immediately past this. */
  discOuterR: number;
  centerX: number;
  centerY: number;
}

/** Upper bound on total star count. Used by the preset to decide how
 *  many points to allocate before generation runs. */
export function starfieldUpperBound (): number {
  // Halo node count depends on the disc's actual outer radius (varies
  // with SCALE + bin contents). 1500 is a generous cap for the current
  // N_HALO_RINGS=22 with decaying fill; field + giants are fixed.
  return 1500 + FIELD_COUNT + GIANT_COUNT
}

export function generateStarfield (geometry: StarfieldGeometry): StarfieldData {
  const { discOuterR, centerX, centerY } = geometry

  // Per-ring fill probability and dot size, computed from ring index.
  // HALO_FULL_RINGS rings stay at 100% then fill decays by
  // HALO_FILL_DECAY^k. Dot size stays at RING_NODE_SIZE for the first
  // HALO_SIZE_START_RING rings, then shrinks linearly to HALO_MIN_SIZE
  // over the remaining rings.
  const haloFill = (k: number): number => {
    if (k < HALO_FULL_RINGS) return 1.0
    return Math.pow(HALO_FILL_DECAY, k - HALO_FULL_RINGS + 1)
  }
  const haloSize = (k: number): number => {
    if (k < HALO_SIZE_START_RING) return RING_NODE_SIZE
    const span = Math.max(1, N_HALO_RINGS - HALO_SIZE_START_RING - 1)
    const t = Math.min(1, (k - HALO_SIZE_START_RING) / span)
    return Math.round(RING_NODE_SIZE - t * (RING_NODE_SIZE - HALO_MIN_SIZE))
  }

  const rand = makeRand(SEED)
  const out: StarPoint[] = []

  const ringSlotCount = (radius: number): number =>
    Math.max(8, Math.round((2 * Math.PI * radius) / HALO_SLOT_SPACING))

  const placeRing = (radius: number, fillProb: number, size: number): void => {
    const slots = ringSlotCount(radius)
    const phase = rand() * Math.PI * 2
    for (let s = 0; s < slots; s += 1) {
      if (fillProb < 1 && rand() > fillProb) continue
      const theta = phase + (s / slots) * Math.PI * 2
      // Tiny radial jitter — visible only on close inspection. Keeps
      // the ring "natural" without making it jagged.
      const jitter = (rand() - 0.5) * (HALO_RING_RADIAL_GAP * 0.05)
      const r = radius + jitter
      const colorIdx = Math.min(STAR_PALETTE.length - 1, Math.floor(rand() * STAR_PALETTE.length))
      out.push({
        x: centerX + Math.cos(theta) * r,
        y: centerY + Math.sin(theta) * r,
        size,
        alpha: HALO_ALPHA,
        color: STAR_PALETTE[colorIdx]!,
      })
    }
  }

  let outermostHaloR = discOuterR
  for (let k = 0; k < N_HALO_RINGS; k += 1) {
    const r = discOuterR + HALO_INNER_OFFSET + (k * HALO_RING_RADIAL_GAP)
    outermostHaloR = r
    placeRing(r, haloFill(k), haloSize(k))
  }

  // Field placement: **1/r radial distribution**.
  //   r = innerR + u * (OUTER - innerR)  // u uniform → density ∝ 1/r
  // This puts ~half the stars inside the inner half of the field
  // (snug against the disc, filling the visible void at default zoom)
  // and spreads the rest out toward FIELD_OUTER_R so zoom-out never
  // reveals an empty box edge.
  const innerR = outermostHaloR + FIELD_INNER_PAD
  const placeFieldStar = (size: number): void => {
    const u = rand()
    const r = innerR + u * (FIELD_OUTER_R - innerR)
    const theta = rand() * Math.PI * 2
    const c = rand()
    out.push({
      x: centerX + Math.cos(theta) * r,
      y: centerY + Math.sin(theta) * r,
      size,
      alpha: FIELD_ALPHA,
      color: STAR_PALETTE[Math.min(STAR_PALETTE.length - 1, Math.floor(c * STAR_PALETTE.length))]!,
    })
  }

  // Plain field stars — the dense bed of small bright points.
  for (let i = 0; i < FIELD_COUNT; i += 1) {
    const w = rand()
    placeFieldStar(FIELD_SIZE_MIN + (w * (FIELD_SIZE_MAX - FIELD_SIZE_MIN)))
  }
  // Bright giants — larger, distinct points scattered with the same
  // 1/r profile so a few are always near the disc and others trail
  // off into deep space. Keeps the field readable at any zoom level.
  for (let i = 0; i < GIANT_COUNT; i += 1) {
    const w = rand()
    placeFieldStar(GIANT_SIZE_MIN + (w * (GIANT_SIZE_MAX - GIANT_SIZE_MIN)))
  }

  return packStarfieldData(out)
}

export function applyStarfieldAttributes (
  pointColors: Float32Array,
  pointSizes: Float32Array,
  binCount: number,
  starfield: StarfieldData,
): void {
  // Cap to whatever capacity remains in the engine's point buffers.
  // Mirrors the truncation in the position copy path so attributes
  // and positions agree on which trailing stars are dropped.
  const capacity = pointSizes.length - binCount
  const count = Math.min(starfield.count, Math.max(0, capacity))
  for (let i = 0; i < count; i += 1) {
    const node = binCount + i
    const ci = node * 4
    pointColors[ci] = starfield.colors[i * 3] as number
    pointColors[ci + 1] = starfield.colors[(i * 3) + 1] as number
    pointColors[ci + 2] = starfield.colors[(i * 3) + 2] as number
    pointColors[ci + 3] = starfield.alphas[i] as number
    pointSizes[node] = starfield.sizes[i] as number
  }
}
