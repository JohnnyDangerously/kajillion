import {
  ensureFillSampledPointsSetup,
  ensureFindHoveredPointSetup,
  ensureFindPointsInPolygonSetup,
  ensureFindPointsInRectSetup,
} from './commands'
import type { PointSearchSetupOptions, PointSearchSetupState } from './contracts'

export function ensurePointSearchSetup (options: PointSearchSetupOptions): PointSearchSetupState {
  return {
    ...ensureFindPointsInRectSetup(options),
    ...ensureFindPointsInPolygonSetup(options),
    ...ensureFindHoveredPointSetup(options),
    ...ensureFillSampledPointsSetup(options),
  }
}
