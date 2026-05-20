import { UniformStore, type Buffer, type ComputePipeline, type Device, type Shader } from '@luma.gl/core'
import { ensureVec2 } from '@/graph/modules/Shared/uniform-utils'
import { DEFAULT_POINT_LOD_ZOOM_RANGE } from '@/graph/modules/Points/passes/shared/constants'
import type { Mat4Array } from '@/graph/modules/Store'
import type { CullVisiblePointsUniforms } from './contracts'
import {
  ensureVisiblePointCullComputePipelines,
  ensureVisiblePointPrefixPipelines,
  ensureVisiblePointTileBudgetPipeline,
} from './pipelineSetup'

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

export function ensureVisiblePointCullPipelines (
  device: Device,
  state: VisiblePointCullPipelineState,
  options: VisiblePointCullPipelineOptions,
): VisiblePointCullPipelineState {
  if (device.info?.type !== 'webgpu') return state
  const nextState = { ...state }
  nextState.uniformStore ||= new UniformStore({
    cullUniforms: {
      uniformTypes: {
        ratio: 'f32',
        transformationMatrix: 'mat4x4<f32>',
        pointCount: 'u32',
        spaceSize: 'f32',
        screenSize: 'vec2<f32>',
        sizeScale: 'f32',
        scalePointsOnZoom: 'f32',
        maxPointSize: 'f32',
        pointMinPixelSize: 'f32',
        pointLodStrength: 'f32',
        pointLodZoomRange: 'vec2<f32>',
        pointLodMinSampleRate: 'f32',
        pointLodSizeCompensation: 'f32',
        renderPositionMix: 'f32',
        activeMaskEnabled: 'f32',
        tileBudget: 'u32',
        tileBudgetSize: 'f32',
        tileBudgetColumns: 'u32',
        tileBudgetRows: 'u32',
        tileBudgetSlots: 'u32',
      },
      defaultUniforms: {
        ratio: options.ratio,
        transformationMatrix: options.transformationMatrix,
        pointCount: options.pointCount,
        spaceSize: options.spaceSize,
        screenSize: ensureVec2(options.screenSize, [0, 0]),
        sizeScale: options.sizeScale,
        scalePointsOnZoom: options.scalePointsOnZoom ? 1 : 0,
        maxPointSize: options.maxPointSize,
        pointMinPixelSize: options.pointMinPixelSize,
        pointLodStrength: options.pointLodStrength,
        pointLodZoomRange: ensureVec2(options.pointLodZoomRange, DEFAULT_POINT_LOD_ZOOM_RANGE),
        pointLodMinSampleRate: options.pointLodMinSampleRate,
        pointLodSizeCompensation: options.pointLodSizeCompensation,
        renderPositionMix: options.renderPositionMix,
        activeMaskEnabled: options.hasActiveFilter ? 1 : 0,
        tileBudget: 0,
        tileBudgetSize: options.tileBudgetSize,
        tileBudgetColumns: 1,
        tileBudgetRows: 1,
        tileBudgetSlots: 1,
      },
    },
  })
  nextState.uniformBuffer ||= nextState.uniformStore.getManagedUniformBuffer(device, 'cullUniforms')

  ensureVisiblePointCullComputePipelines(device, nextState)
  ensureVisiblePointTileBudgetPipeline(device, nextState)
  ensureVisiblePointPrefixPipelines(device, nextState)

  return nextState
}
