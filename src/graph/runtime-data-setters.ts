import type { GraphConfig } from '@/graph/config'
import {
  shouldSkipRuntimeDataUpdate,
  type RuntimeDataUpdateContext,
} from './runtime-data-update-context'
import { applyConfigUpdate, applyLinksUpdate, applyPointPositionsUpdate } from './runtime-data-setter-helpers'

export type {
  RuntimeDataUpdateContext,
  RuntimeDataUpdateFlags,
} from './runtime-data-update-context'

export function setRuntimeConfig (
  context: RuntimeDataUpdateContext,
  config: GraphConfig,
  requeue: () => void,
): void {
  if (shouldSkipRuntimeDataUpdate(context, requeue)) return
  applyConfigUpdate(context, config)
}

export function setRuntimeConfigPartial (
  context: RuntimeDataUpdateContext,
  config: GraphConfig,
  requeue: () => void,
): void {
  if (shouldSkipRuntimeDataUpdate(context, requeue)) return
  applyConfigUpdate(context, config, true)
}

export function setRuntimePointPositions (
  context: RuntimeDataUpdateContext,
  pointPositions: Float32Array,
  dontRescale: boolean | undefined,
  requeue: () => void,
): void {
  if (shouldSkipRuntimeDataUpdate(context, requeue)) return
  applyPointPositionsUpdate(context, pointPositions, dontRescale)
}

export function setRuntimePointColors (
  context: RuntimeDataUpdateContext,
  pointColors: Float32Array,
  requeue: () => void,
): void {
  if (shouldSkipRuntimeDataUpdate(context, requeue)) return
  context.graph.inputPointColors = pointColors
  context.setUpdateFlags({ isPointColorUpdateNeeded: true })
}

export function setRuntimePointSizes (
  context: RuntimeDataUpdateContext,
  pointSizes: Float32Array,
  requeue: () => void,
): void {
  if (shouldSkipRuntimeDataUpdate(context, requeue)) return
  context.graph.inputPointSizes = pointSizes
  context.setUpdateFlags({ isPointSizeUpdateNeeded: true })
}

export function setRuntimePointShapes (
  context: RuntimeDataUpdateContext,
  pointShapes: Float32Array,
  requeue: () => void,
): void {
  if (shouldSkipRuntimeDataUpdate(context, requeue)) return
  context.graph.inputPointShapes = pointShapes
  context.setUpdateFlags({ isPointShapeUpdateNeeded: true })
}

export function setRuntimeImageData (
  context: RuntimeDataUpdateContext,
  imageDataArray: ImageData[],
  requeue: () => void,
): void {
  if (shouldSkipRuntimeDataUpdate(context, requeue)) return
  context.graph.inputImageData = imageDataArray
  context.getPoints()?.createAtlas()
}

export function setRuntimePointImageIndices (
  context: RuntimeDataUpdateContext,
  imageIndices: Float32Array,
  requeue: () => void,
): void {
  if (shouldSkipRuntimeDataUpdate(context, requeue)) return
  context.graph.inputPointImageIndices = imageIndices
  context.setUpdateFlags({ isPointImageIndicesUpdateNeeded: true })
}

export function setRuntimePointImageSizes (
  context: RuntimeDataUpdateContext,
  imageSizes: Float32Array,
  requeue: () => void,
): void {
  if (shouldSkipRuntimeDataUpdate(context, requeue)) return
  context.graph.inputPointImageSizes = imageSizes
  context.setUpdateFlags({ isPointImageSizesUpdateNeeded: true })
}

export function setRuntimeLinks (
  context: RuntimeDataUpdateContext,
  links: Float32Array,
  requeue: () => void,
): void {
  if (shouldSkipRuntimeDataUpdate(context, requeue)) return
  applyLinksUpdate(context, links)
}

export function setRuntimeLinkColors (
  context: RuntimeDataUpdateContext,
  linkColors: Float32Array,
  requeue: () => void,
): void {
  if (shouldSkipRuntimeDataUpdate(context, requeue)) return
  context.graph.inputLinkColors = linkColors
  context.setUpdateFlags({ isLinkColorUpdateNeeded: true })
}

export function setRuntimeLinkWidths (
  context: RuntimeDataUpdateContext,
  linkWidths: Float32Array,
  requeue: () => void,
): void {
  if (shouldSkipRuntimeDataUpdate(context, requeue)) return
  context.graph.inputLinkWidths = linkWidths
  context.setUpdateFlags({ isLinkWidthUpdateNeeded: true })
}

export function setRuntimeLinkArrows (
  context: RuntimeDataUpdateContext,
  linkArrows: boolean[],
  requeue: () => void,
): void {
  if (shouldSkipRuntimeDataUpdate(context, requeue)) return
  context.graph.linkArrowsBoolean = linkArrows
  context.setUpdateFlags({ isLinkArrowUpdateNeeded: true })
}

export function setRuntimeLinkStrength (
  context: RuntimeDataUpdateContext,
  linkStrength: Float32Array,
  requeue: () => void,
): void {
  if (shouldSkipRuntimeDataUpdate(context, requeue)) return
  context.graph.inputLinkStrength = linkStrength
  context.setUpdateFlags({ isForceLinkUpdateNeeded: true })
}

export function setRuntimePointClusters (
  context: RuntimeDataUpdateContext,
  pointClusters: (number | undefined)[],
  requeue: () => void,
): void {
  if (shouldSkipRuntimeDataUpdate(context, requeue)) return
  context.graph.inputPointClusters = pointClusters
  context.setUpdateFlags({ isPointClusterUpdateNeeded: true })
}

export function setRuntimeClusterPositions (
  context: RuntimeDataUpdateContext,
  clusterPositions: (number | undefined)[],
  requeue: () => void,
): void {
  if (shouldSkipRuntimeDataUpdate(context, requeue)) return
  context.graph.inputClusterPositions = clusterPositions
  context.setUpdateFlags({ isPointClusterUpdateNeeded: true })
}

export function setRuntimePointClusterStrength (
  context: RuntimeDataUpdateContext,
  clusterStrength: Float32Array,
  requeue: () => void,
): void {
  if (shouldSkipRuntimeDataUpdate(context, requeue)) return
  context.graph.inputClusterStrength = clusterStrength
  context.setUpdateFlags({ isPointClusterUpdateNeeded: true })
}

export function setRuntimePinnedPoints (
  context: RuntimeDataUpdateContext,
  pinnedIndices: number[] | null,
  requeue: () => void,
): void {
  if (shouldSkipRuntimeDataUpdate(context, requeue)) return
  context.graph.inputPinnedPoints = pinnedIndices && pinnedIndices.length > 0 ? pinnedIndices : undefined
  context.getPoints()?.updatePinnedStatus()
}
