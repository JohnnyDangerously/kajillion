import { type Clusters } from '@/graph/modules/Clusters'
import { type ForceCenter } from '@/graph/modules/ForceCenter'
import { LinkDirection, type ForceLink } from '@/graph/modules/ForceLink'
import { type ForceManyBody } from '@/graph/modules/ForceManyBody'
import { type Lines } from '@/graph/modules/Lines'
import { type Points } from '@/graph/modules/Points'

export interface PendingGraphUpdateFlags {
  isPointPositionsUpdateNeeded: boolean;
  isPointColorUpdateNeeded: boolean;
  isPointSizeUpdateNeeded: boolean;
  isPointShapeUpdateNeeded: boolean;
  isPointImageIndicesUpdateNeeded: boolean;
  isLinksUpdateNeeded: boolean;
  isLinkColorUpdateNeeded: boolean;
  isLinkWidthUpdateNeeded: boolean;
  isLinkArrowUpdateNeeded: boolean;
  isPointClusterUpdateNeeded: boolean;
  isForceManyBodyUpdateNeeded: boolean;
  isForceLinkUpdateNeeded: boolean;
  isForceCenterUpdateNeeded: boolean;
  isPointImageSizesUpdateNeeded: boolean;
}

export interface ApplyPendingGraphUpdatesOptions {
  flags: PendingGraphUpdateFlags;
  points: Points | undefined;
  lines: Lines | undefined;
  forceManyBody: ForceManyBody | undefined;
  forceLinkIncoming: ForceLink | undefined;
  forceLinkOutgoing: ForceLink | undefined;
  forceCenter: ForceCenter | undefined;
  clusters: Clusters | undefined;
}

export function createClearedPendingGraphUpdateFlags (): PendingGraphUpdateFlags {
  return {
    isPointPositionsUpdateNeeded: false,
    isPointColorUpdateNeeded: false,
    isPointSizeUpdateNeeded: false,
    isPointShapeUpdateNeeded: false,
    isPointImageIndicesUpdateNeeded: false,
    isLinksUpdateNeeded: false,
    isLinkColorUpdateNeeded: false,
    isLinkWidthUpdateNeeded: false,
    isLinkArrowUpdateNeeded: false,
    isPointClusterUpdateNeeded: false,
    isForceManyBodyUpdateNeeded: false,
    isForceLinkUpdateNeeded: false,
    isForceCenterUpdateNeeded: false,
    isPointImageSizesUpdateNeeded: false,
  }
}

export function applyPendingGraphUpdates ({
  flags,
  points,
  lines,
  forceManyBody,
  forceLinkIncoming,
  forceLinkOutgoing,
  forceCenter,
  clusters,
}: ApplyPendingGraphUpdatesOptions): PendingGraphUpdateFlags {
  if (!points || !lines) return flags

  if (flags.isPointPositionsUpdateNeeded) points.updatePositions()
  if (flags.isPointColorUpdateNeeded) points.updateColor()
  if (flags.isPointSizeUpdateNeeded) points.updateSize()
  if (flags.isPointShapeUpdateNeeded) points.updateShape()
  if (flags.isPointImageIndicesUpdateNeeded) points.updateImageIndices()
  if (flags.isPointImageSizesUpdateNeeded) points.updateImageSizes()

  if (flags.isLinksUpdateNeeded) lines.updatePointsBuffer()
  if (flags.isLinkColorUpdateNeeded) lines.updateColor()
  if (flags.isLinkWidthUpdateNeeded) lines.updateWidth()
  if (flags.isLinkArrowUpdateNeeded) lines.updateArrow()

  if (flags.isForceManyBodyUpdateNeeded) forceManyBody?.create()
  if (flags.isForceLinkUpdateNeeded) {
    forceLinkIncoming?.create(LinkDirection.INCOMING)
    forceLinkOutgoing?.create(LinkDirection.OUTGOING)
  }
  if (flags.isForceCenterUpdateNeeded) forceCenter?.create()
  if (flags.isPointClusterUpdateNeeded) clusters?.create()

  return createClearedPendingGraphUpdateFlags()
}
