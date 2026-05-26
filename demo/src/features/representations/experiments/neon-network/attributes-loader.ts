/**
 * Loader for the per-node facet attributes manifest written by
 * `scripts/build-network-facets.py`. The manifest is a parallel-array
 * sibling of photo-manifest.json — its index i corresponds to the same
 * eid as photo-manifest.eids[i], so render-index lookup goes through
 * the eid map already built by the network loader.
 */

export interface NetworkAttributesManifest {
  count: number;
  /** Parallel to other arrays. Maps to render-indices via eid lookup. */
  eids: number[];
  companies: (string | null)[];
  industries: (string | null)[];
  markets: (string | null)[];
  titles: (string | null)[];
  functions: (string | null)[];
  levels: (string | null)[];
}

/** Returned by `slice()`: per-node arrays parallel to render-index. */
export interface SlicedAttributes {
  companies: (string | null)[];
  industries: (string | null)[];
  markets: (string | null)[];
  titles: (string | null)[];
  functions: (string | null)[];
  levels: (string | null)[];
  /** Per-node bitmask: which nodes have ANY non-null attribute. */
  hasAny: Uint8Array;
}

import { variantBase } from './shared'

export async function loadAttributesManifest (): Promise<NetworkAttributesManifest | null> {
  try {
    const res = await fetch(`${variantBase()}/attributes.json`)
    if (!res.ok) return null
    return (await res.json()) as NetworkAttributesManifest
  } catch {
    return null
  }
}

/**
 * Re-index an attributes manifest by render-index. Returns parallel arrays
 * sized to `nodeCount` where each slot corresponds to the render-position
 * of the matching node, or null when no attribute was loaded for that eid.
 */
export function sliceByRenderIndex (
  manifest: NetworkAttributesManifest,
  eids: Uint32Array
): SlicedAttributes {
  const n = eids.length
  const companies: (string | null)[] = new Array(n).fill(null)
  const industries: (string | null)[] = new Array(n).fill(null)
  const markets: (string | null)[] = new Array(n).fill(null)
  const titles: (string | null)[] = new Array(n).fill(null)
  const functions: (string | null)[] = new Array(n).fill(null)
  const levels: (string | null)[] = new Array(n).fill(null)
  const hasAny = new Uint8Array(n)

  const eidToIdx = new Map<number, number>()
  for (let i = 0; i < n; i += 1) eidToIdx.set(eids[i] as number, i)

  const fields: { src: keyof NetworkAttributesManifest; dst: (string | null)[] }[] = [
    { src: 'companies', dst: companies },
    { src: 'industries', dst: industries },
    { src: 'markets', dst: markets },
    { src: 'titles', dst: titles },
    { src: 'functions', dst: functions },
    { src: 'levels', dst: levels },
  ]

  for (let m = 0; m < manifest.count; m += 1) {
    const eid = manifest.eids[m] as number
    const renderIdx = eidToIdx.get(eid)
    if (renderIdx === undefined) continue
    for (const { src, dst } of fields) {
      const v = (manifest[src] as (string | null)[])[m]
      if (v !== null && v !== undefined) { dst[renderIdx] = v; hasAny[renderIdx] = 1 }
    }
  }

  return { companies, industries, markets, titles, functions, levels, hasAny }
}
