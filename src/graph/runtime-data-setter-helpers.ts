import {
  applyConfig,
  resetConfigToDefaults,
  type GraphConfig,
} from '@/graph/config'

import type { RuntimeDataUpdateContext } from './runtime-data-update-context'

export function applyConfigUpdate (
  context: RuntimeDataUpdateContext,
  config: GraphConfig,
  isPartial = false,
): void {
  const prevConfig = { ...context.config }
  if (!isPartial) resetConfigToDefaults(context.config)
  applyConfig(context.config, config, isPartial)
  context.applyConfigUpdate(prevConfig)
}

export function applyPointPositionsUpdate (
  context: RuntimeDataUpdateContext,
  pointPositions: Float32Array,
  dontRescale: boolean | undefined,
): void {
  context.graph.inputPointPositions = pointPositions
  const points = context.getPoints()
  if (points) points.shouldSkipRescale = dontRescale
  context.setUpdateFlags({
    isPointPositionsUpdateNeeded: true,
    isLinksUpdateNeeded: true,
    isPointColorUpdateNeeded: true,
    isPointSizeUpdateNeeded: true,
    isPointShapeUpdateNeeded: true,
    isPointImageIndicesUpdateNeeded: true,
    isPointImageSizesUpdateNeeded: true,
    isPointClusterUpdateNeeded: true,
    isForceManyBodyUpdateNeeded: true,
    isForceLinkUpdateNeeded: true,
    isForceCenterUpdateNeeded: true,
  })
  context.markPointPositionsChanged(true)
}

export function applyLinksUpdate (
  context: RuntimeDataUpdateContext,
  links: Float32Array,
): void {
  context.graph.inputLinks = links
  context.setUpdateFlags({
    isLinksUpdateNeeded: true,
    isLinkColorUpdateNeeded: true,
    isLinkWidthUpdateNeeded: true,
    isLinkArrowUpdateNeeded: true,
    isForceLinkUpdateNeeded: true,
  })
  context.markLinksChanged()
}
