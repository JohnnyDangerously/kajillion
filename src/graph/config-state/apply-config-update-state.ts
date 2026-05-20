import { type GraphConfigInterface } from '@/graph/config'

import { type ConfigUpdateStateContext } from './config-update-state-context'
import { applyConfigUpdateStateEffects } from './config-update-state-effects'

export { type ConfigUpdateStateContext } from './config-update-state-context'

export function preserveInitOnlyConfigFields (
  config: GraphConfigInterface,
  prevConfig: GraphConfigInterface
): void {
  config.enableSimulation = prevConfig.enableSimulation
  config.initialZoomLevel = prevConfig.initialZoomLevel
  config.randomSeed = prevConfig.randomSeed
  config.attribution = prevConfig.attribution
}

export function applyConfigUpdateState (
  prevConfig: GraphConfigInterface,
  context: ConfigUpdateStateContext
): void {
  applyConfigUpdateStateEffects(prevConfig, context)
}
