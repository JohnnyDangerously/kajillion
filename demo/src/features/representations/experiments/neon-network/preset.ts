import { applyNeonNetworkGraphConfig } from './graph-config'
import { installNeonNetwork } from './install'
import { transformNeonNetworkAttributes, transformNeonNetworkPositions } from './transforms'
import type { RepresentationPreset } from '../../types'

export const neonNetworkPreset: RepresentationPreset = {
  id: 'neon-network',
  ownsCamera: true,
  applyGraphConfig: applyNeonNetworkGraphConfig,
  transformPositions: transformNeonNetworkPositions,
  transformAttributes: transformNeonNetworkAttributes,
  install: installNeonNetwork,
}
