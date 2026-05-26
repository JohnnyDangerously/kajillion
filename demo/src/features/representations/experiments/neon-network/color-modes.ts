import type { SlicedAttributes } from './attributes-loader'

export type FacetColorMode = 'markets' | 'levels' | 'functions' | 'industries' | 'companies'
export type ColorMode = 'hue' | FacetColorMode

export const COLOR_MODE_LABELS: Record<ColorMode, string> = {
  hue: 'Hue (eid)',
  markets: 'Market',
  levels: 'Level',
  functions: 'Function',
  industries: 'Industry',
  companies: 'Company',
}

// 12 evenly-spaced hues for the categorical palette. Picked to be visually
// distinct under the hop saturation/lightness blend used downstream.
const PALETTE_HUES = [
  10, 35, 60, 95, 135, 175, 200, 225, 260, 290, 320, 350,
]

// Hue used for values that don't fit into the top-N palette (long tail)
// and for nulls. Picked to look like dim slate against the disc.
const TAIL_HUE = 220

// Cache for buildHueLookup. Keyed by (mode, facets-identity, eids-identity)
// so we never rebuild a 3000-entry value→hue map across rapid calls during
// a single mode change. WeakMap entries get GC'd if facets get reloaded.
type CacheEntry = { lookup: (i: number) => number }
const lookupCache = new WeakMap<SlicedAttributes, Map<ColorMode, CacheEntry>>()
let hueOnlyLookup: ((i: number) => number) | null = null
let hueOnlyEids: Uint32Array | null = null

// Build a "hue per node index" lookup based on the chosen color mode.
// Falls back to the eid-hash hue when the mode requires facets that aren't
// present.
export function buildHueLookup (
  mode: ColorMode,
  eids: Uint32Array,
  facets: SlicedAttributes | undefined
): (i: number) => number {
  if (mode === 'hue' || !facets) {
    if (hueOnlyLookup && hueOnlyEids === eids) return hueOnlyLookup
    const fn = (i: number): number => hashHue(eids[i] as number)
    hueOnlyLookup = fn
    hueOnlyEids = eids
    return fn
  }
  let byMode = lookupCache.get(facets)
  if (!byMode) { byMode = new Map(); lookupCache.set(facets, byMode) }
  const cached = byMode.get(mode)
  if (cached) return cached.lookup

  const arr = facets[mode]
  if (!arr) return buildHueLookup('hue', eids, facets)

  // Count frequencies so the most common values get the most distinct
  // palette hues — same ordering as the chips in the facet bar.
  const counts = new Map<string, number>()
  for (const v of arr) { if (v) counts.set(v, (counts.get(v) ?? 0) + 1) }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const hueByValue = new Map<string, number>()
  for (let i = 0; i < sorted.length; i += 1) {
    hueByValue.set(sorted[i]![0], i < PALETTE_HUES.length ? PALETTE_HUES[i]! : TAIL_HUE)
  }

  const lookup = (i: number): number => {
    const v = arr[i]
    if (!v) return TAIL_HUE
    return hueByValue.get(v) ?? TAIL_HUE
  }
  byMode.set(mode, { lookup })
  return lookup
}

// Same stable eid → hue hash the rep has always used for the "rainbow ring"
// look. Exported so the rest of the rep can stay consistent.
export function hashHue (eid: number): number {
  return (Math.imul(eid + 1, 2654435761) >>> 0) / 0x1_0000_0000 * 360
}
