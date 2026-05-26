import type { VisualAttributes } from '../../../ui-state/visual-attributes'
import { hashHue } from './color-modes'
import type { LoadedNetwork } from './network-types'
import { isLightTheme } from './shared'

interface NeonNetworkStyleInput {
  attributes: VisualAttributes;
  network: LoadedNetwork;
  /** Bitmask of node-indices that have a photo in the current atlas. */
  photoMask?: Uint8Array;
  /** Override the hue used per node. Defaults to a stable hash of eid so the
   *  disc reads as a polychrome field. Color-by-facet supplies a palette
   *  lookup instead. */
  hueLookup?: (nodeIndex: number) => number;
  /** When true, render the disc in the star palette (white / off-white /
   *  soft blue) instead of HSL hues. Used in the default "hue" mode so
   *  the disc reads as part of a starscape; facet modes (markets,
   *  industries, etc.) still get their distinctive colors. */
  starPalette?: boolean;
}

// Disc node sizes. Chunky-dot pass: hop-1 dots bumped from 56 → 96
// so each contact reads as a distinct, recognisable mark at default
// zoom instead of a 4-pixel speck. Hop-2 hidden (size 0) — its 1k
// thin-ring nodes were the bulk of the "tiny + bleh" look; the disc
// is now hop-0 + hop-1 only, which is the network you actually want
// to look at first anyway. Backed out via ?showHop2 if needed.
const SIZE_ROOT = 260
const SIZE_DOT = 96
const SIZE_PHOTO = 96
const SIZE_HOP2 = 0

// Saturation + lightness for facet-mode dots.
// Dark theme: vivid pastels on black — light=0.58 keeps them bright
//   on the dark background without pure-100% saturation banding.
// Light theme: fully-saturated colours at mid-lightness (~0.48). Any
//   darker and they look navy/maroon on white; any lighter and they
//   wash out. 1.0 sat is needed because partially desaturated colours
//   read as grey on a white background — the eye picks up saturation
//   far more readily than lightness here.
function discSatLight (isLight: boolean, hop: 1 | 2 | 'photo'): { sat: number; light: number } {
  if (isLight) {
    if (hop === 'photo') return { sat: 1.00, light: 0.48 }
    if (hop === 1) return { sat: 1.00, light: 0.50 }
    return { sat: 1.00, light: 0.46 }
  }
  if (hop === 'photo') return { sat: 0.95, light: 0.62 }
  if (hop === 1) return { sat: 0.95, light: 0.58 }
  return { sat: 0.88, light: 0.55 }
}

// Star palette — picked to match the halo + outer starfield so the
// disc reads as the bright centre of a starscape rather than an
// unrelated polychrome blob. Weights toward white; cooler tones for
// variety. Photo nodes get a slight warm bias; non-photo a slight cool
// bias, derived from the eid hash so each node's colour is stable.
const STAR_COLORS: ReadonlyArray<readonly [number, number, number]> = [
  [1.00, 1.00, 1.00], // pure white
  [1.00, 1.00, 1.00], // pure white (extra weight)
  [0.96, 0.98, 1.00], // very cool white
  [0.86, 0.92, 1.00], // soft blue-white
  [0.78, 0.88, 1.00], // soft blue
  [1.00, 0.97, 0.92], // warm off-white
]

export function applyNeonNetworkAttributes (input: NeonNetworkStyleInput): void {
  const { attributes, network, photoMask, hueLookup, starPalette } = input
  const { pointColors, pointSizes } = attributes
  const n = network.nodeCount
  const isLight = isLightTheme()
  const hueAt = hueLookup ?? ((i: number) => hashHue(network.eids[i] as number))

  for (let i = 0; i < n; i += 1) {
    const hop = network.hops[i] as number
    const hasPhoto = photoMask !== undefined && photoMask[i] === 1
    const ci = i * 4

    if (hop === 0) {
      // John = pure white on dark, pure black on light, so he's the
      // strongest mark on the canvas regardless of background.
      const v = isLight ? 0 : 1
      pointColors[ci] = v
      pointColors[ci + 1] = v
      pointColors[ci + 2] = v
      pointColors[ci + 3] = 1
      pointSizes[i] = SIZE_ROOT
      continue
    }

    // Star palette is white-on-black; suppress it under the light
     // theme and fall through to the rainbow HSL path so hue mode
     // still produces a visible disc on white.
    if (starPalette && !isLight) {
      // Deterministic palette pick by eid hash → same person always
      // gets the same colour. Bias photo nodes 1 slot warmer so faces
      // stand out subtly without breaking the star aesthetic.
      const eid = network.eids[i] as number
      const idx = (eid * 0x9E3779B9) >>> 0
      let slot = idx % STAR_COLORS.length
      if (hasPhoto) slot = (slot + (STAR_COLORS.length - 1)) % STAR_COLORS.length
      const c = STAR_COLORS[slot]!
      // Hop-2 nodes slightly dimmer so the outer rings recede into
      // the halo / starfield instead of competing with hop-1.
      const dim = hop === 1 ? 1 : 0.78
      pointColors[ci] = c[0] * dim
      pointColors[ci + 1] = c[1] * dim
      pointColors[ci + 2] = c[2] * dim
      pointColors[ci + 3] = 1
      pointSizes[i] = hop === 2 ? SIZE_HOP2 : (hasPhoto ? SIZE_PHOTO : SIZE_DOT)
      continue
    }

    // Facet / HSL path — unchanged. Used by markets / industries /
    // levels / etc. where each value should pop in its own colour.
    let hue = hueAt(i)
    const role = hasPhoto ? 'photo' as const : hop === 1 ? 1 as const : 2 as const
    let { sat, light } = discSatLight(isLight, role)
    // Light-theme hue mode = bright orange shades. Tuned away from
    // muddy brown territory: hue stays in the 22–46 range (pure
    // orange→tangerine→amber, no red-orange that goes brown when
    // darkened), saturation pinned at 0.90+ so colours stay candy-
    // bright, lightness raised to 0.56–0.74 so dots read as warm
    // glow rather than burnt sienna.
    if (isLight && starPalette) {
      const h = ((network.eids[i] as number) * 0x9E3779B9) >>> 0
      // Tangerine/amber band — push lightness high (0.62..0.82) so
      // small-dot antialiasing leaves them bright instead of burnt.
      // Saturation pinned ≥ 0.95 for the candy-bright pop. Hue narrow
      // 24..44 = "true orange" (no red bias = no brown when dimmed).
      hue = 24 + ((h & 0xFF) / 255) * 20
      sat = 0.95 + (((h >>> 8) & 0xFF) / 255) * 0.05
      light = 0.62 + (((h >>> 16) & 0xFF) / 255) * 0.20
    }
    const c = (1 - Math.abs((2 * light) - 1)) * sat
    const hp = hue / 60
    const x = c * (1 - Math.abs((hp % 2) - 1))
    let r1 = 0, g1 = 0, b1 = 0
    if (hp < 1) { r1 = c; g1 = x }
    else if (hp < 2) { r1 = x; g1 = c }
    else if (hp < 3) { g1 = c; b1 = x }
    else if (hp < 4) { g1 = x; b1 = c }
    else if (hp < 5) { r1 = x; b1 = c }
    else { r1 = c; b1 = x }
    const m = light - (c / 2)
    pointColors[ci] = r1 + m
    pointColors[ci + 1] = g1 + m
    pointColors[ci + 2] = b1 + m
    pointColors[ci + 3] = 1
    pointSizes[i] = hop === 2 ? SIZE_HOP2 : (hasPhoto ? SIZE_PHOTO : SIZE_DOT)
  }
}
