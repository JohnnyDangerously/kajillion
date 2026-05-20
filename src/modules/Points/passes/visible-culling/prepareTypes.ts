import type { Buffer, ComputePipeline, Device, Shader, UniformStore } from '@luma.gl/core'
import type { GraphConfigInterface } from '@/graph/config'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Store } from '@/graph/modules/Store'
import type { GpuTimerLike } from '@/graph/modules/Points/passes/shared/contracts'
import type { CullVisiblePointsUniforms } from '@/graph/modules/Points/passes/visible-culling/contracts'

export type VisiblePointCullState = {
  visiblePointIndexBuffer: Buffer | undefined;
  visiblePointIndirectBuffer: Buffer | undefined;
  visiblePointGroupOffsetBuffer: Buffer | undefined;
  visiblePointMaskBuffer: Buffer | undefined;
  visiblePointBlockSumBuffer: Buffer | undefined;
  visiblePointBlockOffsetBuffer: Buffer | undefined;
  visiblePointTileBudgetBuffer: Buffer | undefined;
  visiblePointCapacity: number;
  visiblePointGroupCapacity: number;
  visiblePointBlockCapacity: number;
  visiblePointTileBudgetCapacity: number;
  cullVisiblePointsUniformStore: UniformStore<CullVisiblePointsUniforms> | undefined;
  cullVisiblePointsUniformBuffer: Buffer | undefined;
  cullVisiblePointsPipeline: ComputePipeline | undefined;
  prefixVisiblePointsPipeline: ComputePipeline | undefined;
  prefixVisiblePointBlocksPipeline: ComputePipeline | undefined;
  addVisiblePointBlockOffsetsPipeline: ComputePipeline | undefined;
  clearVisiblePointTileBudgetPipeline: ComputePipeline | undefined;
  selectVisiblePointTileBudgetPipeline: ComputePipeline | undefined;
  scatterVisiblePointsPipeline: ComputePipeline | undefined;
  cullVisiblePointsShader: Shader | undefined;
  prefixVisiblePointsShader: Shader | undefined;
  clearVisiblePointTileBudgetShader: Shader | undefined;
  isCulledPointDrawPrepared: boolean;
}

export type PrepareVisiblePointCullOptions = {
  device: Device;
  data: GraphData;
  config: GraphConfigInterface;
  store: Store;
  state: VisiblePointCullState;
  forcePolicy: boolean;
  timer?: GpuTimerLike;
  effectivePixelRatio: number;
  renderPositionMix: number;
  imageCount: number;
  hasNonCircleShapes: boolean;
  positionStorageBuffer: Buffer | undefined;
  previousRenderPositionStorageBuffer: Buffer | undefined;
  sizeBuffer: Buffer | undefined;
  colorBuffer: Buffer | undefined;
  pointStatusStorageBuffer: Buffer | undefined;
  activePointMaskBuffer: Buffer | undefined;
  updateActivePointMask: () => Buffer | undefined;
  ensureSizeBuffer: () => Buffer | undefined;
  ensureColorBuffer: () => Buffer | undefined;
  getEffectivePointLodStrength: () => number;
}

export type PrepareVisiblePointCullResult = {
  state: VisiblePointCullState;
  prepared: boolean;
}
