import type { ExplorerFacets } from './types'

export type FacetField =
  | 'markets'
  | 'levels'
  | 'functions'
  | 'industries'
  | 'companies'
  | 'titles'

export interface FacetValueCount { value: string; count: number }
export interface FacetSummary {
  field: FacetField;
  /** Top-N values by count, descending. */
  values: FacetValueCount[];
  /** Total non-null entries for this facet. */
  total: number;
}

// Ordered low- → high-cardinality so the bar reads naturally top-to-bottom.
const FIELD_LABELS: Record<FacetField, string> = {
  markets: 'Market',
  levels: 'Level',
  functions: 'Function',
  industries: 'Industry',
  companies: 'Company',
  titles: 'Title',
}

export function facetLabel (field: FacetField): string {
  return FIELD_LABELS[field]
}

/**
 * Aggregate the value distribution for each facet. Caps top-N at 24 so
 * the UI bar stays compact; truncation isn't significant because chip
 * scroll lets the user reach the long tail.
 */
export function summariseFacets (facets: ExplorerFacets, topN = 24): FacetSummary[] {
  const out: FacetSummary[] = []
  for (const field of Object.keys(FIELD_LABELS) as FacetField[]) {
    const arr = facets[field]
    if (!arr) continue
    const counts = new Map<string, number>()
    let total = 0
    for (const v of arr) {
      if (!v) continue
      total += 1
      counts.set(v, (counts.get(v) ?? 0) + 1)
    }
    const values = [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, topN)
    out.push({ field, values, total })
  }
  return out
}

/**
 * Resolve a current facet selection to a list of node indices that match.
 * Selection is a map field→Set<value>. Within a field, values OR together;
 * across fields, they AND together.
 */
export function indicesForSelection (
  facets: ExplorerFacets,
  nodeCount: number,
  selection: Map<FacetField, Set<string>>
): number[] | null {
  if (selection.size === 0) return null
  const out: number[] = []
  for (let i = 0; i < nodeCount; i += 1) {
    let allMatch = true
    for (const [field, values] of selection) {
      const arr = facets[field]
      const v = arr?.[i] ?? null
      if (!v || !values.has(v)) { allMatch = false; break }
    }
    if (allMatch) out.push(i)
  }
  return out
}
