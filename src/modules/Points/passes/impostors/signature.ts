import type { GraphConfigInterface } from '@/graph/config'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Store } from '@/graph/modules/Store'
import { ensureVec2 } from '@/graph/modules/Shared/uniform-utils'
import type { ImpostorBuildParameters } from '@/graph/modules/Points/passes/impostors/types'

export function getImpostorBuildSignature (options: {
  config: GraphConfigInterface;
  data: GraphData;
  store: Store;
  positionEpoch: number;
  effectivePixelRatio: number;
  tileColumns: number;
  tileRows: number;
  buildParameters: ImpostorBuildParameters;
}): string {
  const { config, data, store } = options
  const matrix = store.transformationMatrix4x4
  const roundedMatrix = [
    matrix[0], matrix[1], matrix[4], matrix[5], matrix[12], matrix[13],
  ].map(value => Math.round((value ?? 0) * 1000) / 1000).join(',')
  const screenSize = ensureVec2(store.screenSize, [0, 0])
  return [
    options.positionEpoch,
    data.pointsNumber ?? 0,
    options.effectivePixelRatio,
    Math.round(screenSize[0]),
    Math.round(screenSize[1]),
    Math.round(store.adjustedSpaceSize),
    roundedMatrix,
    options.tileColumns,
    options.tileRows,
    options.buildParameters.tileSize,
    options.buildParameters.tileBuildSampleRate,
    options.buildParameters.tileBuildSampleWeight,
    config.impostorExactOverlay ? 1 : 0,
    config.impostorStableOverlay ? 1 : 0,
    config.impostorExactOverlaySampleRate,
    config.impostorSparseTileThreshold,
    options.buildParameters.hybridAnchorsPerTile,
  ].join('|')
}
