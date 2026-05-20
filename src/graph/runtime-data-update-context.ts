import type { GraphConfigInterface } from '@/graph/config'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Points } from '@/graph/modules/Points'

export interface RuntimeDataUpdateFlags {
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

export interface RuntimeDataUpdateContext {
  config: GraphConfigInterface;
  graph: GraphData;
  getPoints: () => Points | undefined;
  isDestroyed: () => boolean;
  ensureDevice: (callback: () => void) => boolean;
  applyConfigUpdate: (prevConfig: GraphConfigInterface) => void;
  markPointPositionsChanged: (invalidateKnownPickerData?: boolean) => void;
  markLinksChanged: () => void;
  setUpdateFlags: (flags: Partial<RuntimeDataUpdateFlags>) => void;
}

export function shouldSkipRuntimeDataUpdate (
  context: RuntimeDataUpdateContext,
  requeue: () => void
): boolean {
  return context.isDestroyed() || context.ensureDevice(requeue)
}
