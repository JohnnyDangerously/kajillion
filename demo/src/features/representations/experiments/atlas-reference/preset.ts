import type { RepresentationPreset } from '../../types'
import { referenceCloudPreset } from '../reference-cloud'

export const atlasReferencePreset: RepresentationPreset = {
  ...referenceCloudPreset,
  id: 'atlas-reference',
}
