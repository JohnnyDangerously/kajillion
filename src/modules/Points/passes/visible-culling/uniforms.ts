import type { GraphConfigInterface } from '@/graph/config'
import type { Store } from '@/graph/modules/Store'
import { ensureVec2 } from '@/graph/modules/Shared/uniform-utils'
import { ZERO_VEC2 } from '@/graph/modules/Points/passes/shared/constants'
import type {
  CullVisiblePointsUniforms,
  VisiblePointTileBudgetLayout,
} from '@/graph/modules/Points/passes/visible-culling/contracts'

export type CullVisiblePointsUniformInput = {
  config: GraphConfigInterface;
  store: Store;
  effectivePixelRatio: number;
  pointCount: number;
  pointLodStrength: number;
  pointLodRange: [number, number];
  renderPositionMix: number;
  hasActiveFilter: boolean;
  tileBudgetLayout: VisiblePointTileBudgetLayout;
}

export function createCullVisiblePointsUniformPayload ({
  config,
  store,
  effectivePixelRatio,
  pointCount,
  pointLodStrength,
  pointLodRange,
  renderPositionMix,
  hasActiveFilter,
  tileBudgetLayout,
}: CullVisiblePointsUniformInput): CullVisiblePointsUniforms {
  return {
    cullUniforms: {
      ratio: effectivePixelRatio,
      transformationMatrix: store.transformationMatrix4x4,
      pointCount,
      spaceSize: store.adjustedSpaceSize,
      screenSize: ensureVec2(store.screenSize, ZERO_VEC2),
      sizeScale: config.pointSizeScale,
      scalePointsOnZoom: config.scalePointsOnZoom ? 1 : 0,
      maxPointSize: store.maxPointSize,
      pointMinPixelSize: config.pointMinPixelSize,
      pointLodStrength,
      pointLodZoomRange: pointLodRange,
      pointLodMinSampleRate: config.pointLodMinSampleRate,
      pointLodSizeCompensation: config.pointLodSizeCompensation,
      renderPositionMix,
      activeMaskEnabled: hasActiveFilter ? 1 : 0,
      tileBudget: tileBudgetLayout.budget,
      tileBudgetSize: tileBudgetLayout.tileSize,
      tileBudgetColumns: tileBudgetLayout.tileColumns,
      tileBudgetRows: tileBudgetLayout.tileRows,
      tileBudgetSlots: tileBudgetLayout.slots,
    },
  }
}
