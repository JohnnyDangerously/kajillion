import type { SlicedAttributes } from './attributes-loader'
import type { ColorMode } from './color-modes'
import { pickSecondaryFacet } from './layout-modes'
import type { ExplodeLevel } from './view-stack'

const NULL_KEY = ' null'
const NULL_DISPLAY = 'Unknown'

export function buildExplodeLevel (
  key: string,
  value: string,
  members: number[],
  facet: ColorMode,
  facets: SlicedAttributes | null,
): ExplodeLevel {
  const secondaryFacet = pickSecondaryFacet(facet)
  const secondaryValues = secondaryFacet === 'hue' ? undefined : facets?.[secondaryFacet]
  const subClusters = new Map<string, {
    value: string;
    members: number[];
    centroid: { x: number; y: number } | null;
  }>()
  const byNodeSecondary = new Map<number, string>()

  for (const idx of members) {
    const v = secondaryValues?.[idx] ?? NULL_KEY
    const k = v || NULL_KEY
    byNodeSecondary.set(idx, k)
    let sub = subClusters.get(k)
    if (!sub) {
      sub = { value: k === NULL_KEY ? NULL_DISPLAY : k, members: [], centroid: null }
      subClusters.set(k, sub)
    }
    sub.members.push(idx)
  }

  return { kind: 'explode', key, value, members, facet, secondaryFacet, subClusters, byNodeSecondary }
}
