import type { Buffer, ComputePipeline, Shader, UniformStore } from '@luma.gl/core'

import type { Mat4Array } from '@/graph/modules/Store'
import type { CullVisiblePointsUniforms } from './contracts'

export type VisiblePointCullPipelineState = {
  uniformStore: UniformStore<CullVisiblePointsUniforms> | undefined;
  uniformBuffer: Buffer | undefined;
  cullPipeline: ComputePipeline | undefined;
  prefixGroupsPipeline: ComputePipeline | undefined;
  prefixBlocksPipeline: ComputePipeline | undefined;
  addBlockOffsetsPipeline: ComputePipeline | undefined;
  clearTileBudgetPipeline: ComputePipeline | undefined;
  selectTileBudgetPipeline: ComputePipeline | undefined;
  scatterPipeline: ComputePipeline | undefined;
  cullShader: Shader | undefined;
  prefixShader: Shader | undefined;
  clearTileBudgetShader: Shader | undefined;
}

export type VisiblePointCullPipelineOptions = {
  ratio: number;
  transformationMatrix: Mat4Array;
  pointCount: number;
  spaceSize: number;
  screenSize: [number, number] | undefined;
  sizeScale: number;
  scalePointsOnZoom: boolean;
  maxPointSize: number;
  pointMinPixelSize: number;
  pointLodStrength: number;
  pointLodZoomRange: number[] | undefined;
  pointLodMinSampleRate: number;
  pointLodSizeCompensation: number;
  renderPositionMix: number;
  hasActiveFilter: boolean;
  tileBudgetSize: number;
}
