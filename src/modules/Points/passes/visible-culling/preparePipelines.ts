import { ensureVisiblePointCullPipelines } from '@/graph/modules/Points/passes/visible-culling/pipelines'
import type {
  PrepareVisiblePointCullOptions,
  VisiblePointCullState,
} from '@/graph/modules/Points/passes/visible-culling/prepare'

export type EnsureVisiblePointCullPipelineStateOptions = {
  state: VisiblePointCullState;
  prepareOptions: PrepareVisiblePointCullOptions;
  pointCount: number;
  pointLodStrength: number;
  hasActiveFilter: boolean;
}

export function ensureVisiblePointCullPipelineState ({
  state,
  prepareOptions,
  pointCount,
  pointLodStrength,
  hasActiveFilter,
}: EnsureVisiblePointCullPipelineStateOptions): VisiblePointCullState {
  const pipelineState = ensureVisiblePointCullPipelines(prepareOptions.device, {
    uniformStore: state.cullVisiblePointsUniformStore,
    uniformBuffer: state.cullVisiblePointsUniformBuffer,
    cullPipeline: state.cullVisiblePointsPipeline,
    prefixGroupsPipeline: state.prefixVisiblePointsPipeline,
    prefixBlocksPipeline: state.prefixVisiblePointBlocksPipeline,
    addBlockOffsetsPipeline: state.addVisiblePointBlockOffsetsPipeline,
    clearTileBudgetPipeline: state.clearVisiblePointTileBudgetPipeline,
    selectTileBudgetPipeline: state.selectVisiblePointTileBudgetPipeline,
    scatterPipeline: state.scatterVisiblePointsPipeline,
    cullShader: state.cullVisiblePointsShader,
    prefixShader: state.prefixVisiblePointsShader,
    clearTileBudgetShader: state.clearVisiblePointTileBudgetShader,
  }, {
    ratio: prepareOptions.effectivePixelRatio,
    transformationMatrix: prepareOptions.store.transformationMatrix4x4,
    pointCount,
    spaceSize: prepareOptions.store.adjustedSpaceSize,
    screenSize: prepareOptions.store.screenSize,
    sizeScale: prepareOptions.config.pointSizeScale,
    scalePointsOnZoom: prepareOptions.config.scalePointsOnZoom,
    maxPointSize: prepareOptions.store.maxPointSize,
    pointMinPixelSize: prepareOptions.config.pointMinPixelSize,
    pointLodStrength,
    pointLodZoomRange: prepareOptions.config.pointLodZoomRange,
    pointLodMinSampleRate: prepareOptions.config.pointLodMinSampleRate,
    pointLodSizeCompensation: prepareOptions.config.pointLodSizeCompensation,
    renderPositionMix: prepareOptions.renderPositionMix,
    hasActiveFilter,
    tileBudgetSize: prepareOptions.config.pointTileBudgetSize,
  })

  return {
    ...state,
    cullVisiblePointsUniformStore: pipelineState.uniformStore,
    cullVisiblePointsUniformBuffer: pipelineState.uniformBuffer,
    cullVisiblePointsPipeline: pipelineState.cullPipeline,
    prefixVisiblePointsPipeline: pipelineState.prefixGroupsPipeline,
    prefixVisiblePointBlocksPipeline: pipelineState.prefixBlocksPipeline,
    addVisiblePointBlockOffsetsPipeline: pipelineState.addBlockOffsetsPipeline,
    clearVisiblePointTileBudgetPipeline: pipelineState.clearTileBudgetPipeline,
    selectVisiblePointTileBudgetPipeline: pipelineState.selectTileBudgetPipeline,
    scatterVisiblePointsPipeline: pipelineState.scatterPipeline,
    cullVisiblePointsShader: pipelineState.cullShader,
    prefixVisiblePointsShader: pipelineState.prefixShader,
    clearVisiblePointTileBudgetShader: pipelineState.clearTileBudgetShader,
  }
}
