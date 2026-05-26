import { neonGlassPreset } from './experiments/neon-glass'
import { neonNetworkPreset } from './experiments/neon-network'
import { atlasReferencePreset } from './experiments/atlas-reference'
import { workGraphPreset } from './experiments/work-graph'
import { referenceCloudPreset } from './experiments/reference-cloud'
import type { RepresentationPreset } from './types'

const PRESETS: Record<string, RepresentationPreset> = {
  [workGraphPreset.id]: workGraphPreset,
  [atlasReferencePreset.id]: atlasReferencePreset,
  [referenceCloudPreset.id]: referenceCloudPreset,
  [neonGlassPreset.id]: neonGlassPreset,
  [neonNetworkPreset.id]: neonNetworkPreset,
}

export const DEFAULT_REPRESENTATION_ID = workGraphPreset.id

export function listRepresentationIds (): string[] {
  return Object.keys(PRESETS)
}

export function resolveRepresentation (id: string | null | undefined): RepresentationPreset | null {
  if (!id) return null
  return PRESETS[id] ?? null
}

/**
 * Read `?rep=...` from the current URL. When absent, return the native
 * work-graph island so default URLs stay explicit without changing behavior.
 * Unknown ids still return null.
 */
export function resolveRepresentationFromUrl (search: string = window.location.search): RepresentationPreset | null {
  const params = new URLSearchParams(search)
  const id = params.get('rep')
  return id ? resolveRepresentation(id) : workGraphPreset
}
