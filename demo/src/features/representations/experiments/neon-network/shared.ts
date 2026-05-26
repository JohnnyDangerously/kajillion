// Small utilities used across the rep. Lives here rather than scattered
// across files so behaviour stays consistent — every layout, every
// recolor, every ID hash uses the same primitives.

import type { LoadedNetwork } from './network-types'

/** Golden angle in radians — the natural choice for golden-spiral
 *  packing (uniform-density blobs with no visible spokes). */
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

/** Internal sentinel for "no facet value" (null/empty). Used as the
 *  bucket key so the null group sorts/places consistently. */
export const NULL_KEY = ' null'

/** Pretty label for the null-value bucket in tooltips / breadcrumbs. */
export const NULL_DISPLAY = 'Unknown'

/** True when the demo's `?theme=light` URL param is set. Used by the
 *  rep to switch the disc into a "presentation" mode: white background,
 *  no halo / ambient stars, darker dot colours so clusters read on
 *  white. The bloom + facet layouts + interactions all still work. */
export function isLightTheme (): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('theme') === 'light'
}

/** Resolve the network variant folder from the `?net=…` URL param.
 *  Defaults to `/network-a` — the canonical dataset that includes the
 *  per-node facet manifest (attributes.json) and the full names
 *  manifest (names.json). The bare `/network/` directory is an older
 *  snapshot that lacks those files; defaulting there made the Color-by
 *  dropdown collapse to just "hue" and the disc lose its name labels. */
export function variantBase (): string {
  if (typeof window === 'undefined') return '/network-a'
  const v = new URLSearchParams(window.location.search).get('net')
  return v ? `/network-${v}` : '/network-a'
}

/** Float-channel hslToRgb. Returns each component in [0, 1]. */
export function hslToRgbFloat (h: number, s: number, l: number): { r: number; g: number; b: number } {
  const c = (1 - Math.abs((2 * l) - 1)) * s
  const hp = h / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r1 = 0; let g1 = 0; let b1 = 0
  if (hp < 1) { r1 = c; g1 = x }
  else if (hp < 2) { r1 = x; g1 = c }
  else if (hp < 3) { g1 = c; b1 = x }
  else if (hp < 4) { g1 = x; b1 = c }
  else if (hp < 5) { r1 = x; b1 = c }
  else { r1 = c; b1 = x }
  const m = l - (c / 2)
  return { r: r1 + m, g: g1 + m, b: b1 + m }
}

/** 0-255 hslToRgb, for atlas pixel writes. */
export function hslToRgb255 (h: number, s: number, l: number): { r: number; g: number; b: number } {
  const f = hslToRgbFloat(h, s, l)
  return { r: (f.r * 255) | 0, g: (f.g * 255) | 0, b: (f.b * 255) | 0 }
}

/**
 * Copy Cosmos's `graph.getPointPositions()` result into a Float32Array.
 * Cosmos returns a plain `number[]`; nearly every caller in this rep
 * needs a typed array, so the conversion lived in five different
 * hand-written loops before this helper. Allocates one Float32Array
 * per call — callers in tight loops should reuse a scratch instead.
 */
export function snapshotPositions (live: ArrayLike<number>): Float32Array {
  const out = new Float32Array(live.length)
  for (let i = 0; i < live.length; i += 1) out[i] = live[i] as number
  return out
}

/** Cached root-index lookup. The network bin's root (hop=0) is stable
 *  for the lifetime of a LoadedNetwork, so the linear scan only needs
 *  to run once per load. */
const rootCache = new WeakMap<LoadedNetwork, number>()
export function getRootIndex (network: LoadedNetwork): number {
  const cached = rootCache.get(network)
  if (cached !== undefined) return cached
  let found = -1
  for (let i = 0; i < network.nodeCount; i += 1) {
    if (network.hops[i] === 0) { found = i; break }
  }
  rootCache.set(network, found)
  return found
}

/** Root's (x, y) world position, or (4096, 4096) fallback. */
export function getRootCenter (network: LoadedNetwork): { x: number; y: number } {
  const idx = getRootIndex(network)
  if (idx < 0) return { x: 4096, y: 4096 }
  return {
    x: network.positions[idx * 2] as number,
    y: network.positions[(idx * 2) + 1] as number,
  }
}

/**
 * Build a sizes array where every non-subset node is hidden (size = 0)
 * and subset members keep the size they had before. Used by the explode
 * transition — non-cluster nodes go invisible, cluster members keep
 * their existing per-hop/per-photo sizing. Uses a Uint8Array mask for
 * O(N) lookup instead of `members.includes()` which would be O(N×M).
 */
export function buildFocusSizes (
  prevSizes: Float32Array,
  subset: number[]
): Float32Array {
  const out = new Float32Array(prevSizes.length)
  const mask = new Uint8Array(prevSizes.length)
  for (const idx of subset) mask[idx] = 1
  for (let i = 0; i < prevSizes.length; i += 1) {
    if (mask[i] === 1) out[i] = prevSizes[i] as number
  }
  return out
}
