import { variantBase } from './shared'

/**
 * Full-name manifest produced by `scripts/build-network-names.py`. One
 * entry per render-index — `names[i]` is the full_name for node i, or
 * the empty string when StarRocks has no row for that eid. Parallel to
 * the bin's render order.
 */
export interface NamesManifest {
  count: number;
  names: string[];
}

/** Fetch the per-render-index name list, returning null on any failure
 *  (missing file, bad variant, etc.) so callers can degrade gracefully. */
export async function loadNamesManifest (): Promise<string[] | null> {
  try {
    const res = await fetch(`${variantBase()}/names.json`)
    if (!res.ok) {
      console.warn('[neon-network] names.json fetch returned', res.status)
      return null
    }
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('json')) {
      console.warn('[neon-network] names.json non-json content-type:', ct)
      return null
    }
    const m = (await res.json()) as NamesManifest
    return Array.isArray(m.names) ? m.names : null
  } catch (err) {
    console.warn('[neon-network] names manifest load failed:', err)
    return null
  }
}
