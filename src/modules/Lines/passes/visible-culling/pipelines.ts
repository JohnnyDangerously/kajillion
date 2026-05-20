import { UniformStore, type Buffer, type ComputePipeline, type Device, type Shader } from '@luma.gl/core'

import type { GraphConfigInterface } from '@/graph/config'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Points } from '@/graph/modules/Points'
import type { Store } from '@/graph/modules/Store'
import { clearVisibleLinesComputeWgsl } from '@/graph/modules/Lines/clear-visible-lines.compute.wgsl'
import { cullVisibleLinesComputeWgsl } from '@/graph/modules/Lines/cull-visible-lines.compute.wgsl'
import { DEFAULT_LINK_LOD_ZOOM_RANGE, ZERO_VEC2 } from '@/graph/modules/Lines/passes/shared/constants'
import { ensureVec2 } from '@/graph/modules/Shared/uniform-utils'
import { getEffectiveLinkLodStrength } from '@/graph/modules/Lines/features/draw-lifecycle/lifecycle'

import {
  CLEAR_VISIBLE_LINE_BINDINGS,
  CLEAR_VISIBLE_LINES_UNIFORM_TYPES,
  CULL_VISIBLE_LINE_BINDINGS,
  CULL_VISIBLE_LINES_UNIFORM_TYPES,
  type ClearVisibleLinesUniformStoreShape,
  type CullVisibleLinesUniformStoreShape,
} from './contracts'

export interface VisibleLinePipelineState {
  clearShader: Shader | undefined;
  clearPipeline: ComputePipeline | undefined;
  clearUniformStore: UniformStore<ClearVisibleLinesUniformStoreShape> | undefined;
  clearUniformBuffer: Buffer | undefined;
  cullShader: Shader | undefined;
  cullPipeline: ComputePipeline | undefined;
  cullUniformStore: UniformStore<CullVisibleLinesUniformStoreShape> | undefined;
  cullUniformBuffer: Buffer | undefined;
}

export interface VisibleLinePipelineInput {
  device: Device;
  config: GraphConfigInterface;
  data: GraphData;
  points: Points | undefined;
  store: Store;
  vertexCount: number;
  state: VisibleLinePipelineState;
}

export function ensureVisibleLinePipelines (input: VisibleLinePipelineInput): VisibleLinePipelineState {
  const { config, data, device, points, store, vertexCount, state } = input
  if (device.info?.type !== 'webgpu') return state

  const clearUniformStore = state.clearUniformStore ?? new UniformStore({
    clearLineUniforms: {
      uniformTypes: CLEAR_VISIBLE_LINES_UNIFORM_TYPES,
      defaultUniforms: { vertexCount },
    },
  })
  const clearUniformBuffer = state.clearUniformBuffer ?? clearUniformStore.getManagedUniformBuffer(device, 'clearLineUniforms')
  const clearShader = state.clearShader ?? device.createShader({
    stage: 'compute',
    source: clearVisibleLinesComputeWgsl(),
  })
  const clearPipeline = state.clearPipeline ?? device.createComputePipeline({
    shader: clearShader,
    entryPoint: 'computeMain',
    shaderLayout: { bindings: CLEAR_VISIBLE_LINE_BINDINGS },
  })

  const cullUniformStore = state.cullUniformStore ?? new UniformStore({
    cullLineUniforms: {
      uniformTypes: CULL_VISIBLE_LINES_UNIFORM_TYPES,
      defaultUniforms: {
        transformationMatrix: store.transformationMatrix4x4,
        linkCount: data.linksNumber ?? 0,
        pointsTextureSize: store.pointsTextureSize ?? 0,
        spaceSize: store.adjustedSpaceSize,
        screenSize: ensureVec2(store.screenSize, ZERO_VEC2),
        curvedLinkControlPointDistance: config.curvedLinkControlPointDistance,
        renderPositionMix: points?.renderPositionMix ?? 1,
        linkMinPixelLength: config.linkMinPixelLength,
        linkLodStrength: getEffectiveLinkLodStrength(config),
        linkLodZoomRange: ensureVec2(config.linkLodZoomRange, DEFAULT_LINK_LOD_ZOOM_RANGE),
        linkLodMinSampleRate: config.linkLodMinSampleRate,
        hoveredLinkIndex: store.hoveredLinkIndex ?? -1,
        focusedLinkIndex: config.focusedLinkIndex ?? -1,
      },
    },
  })
  const cullUniformBuffer = state.cullUniformBuffer ?? cullUniformStore.getManagedUniformBuffer(device, 'cullLineUniforms')
  const cullShader = state.cullShader ?? device.createShader({
    stage: 'compute',
    source: cullVisibleLinesComputeWgsl(),
  })
  const cullPipeline = state.cullPipeline ?? device.createComputePipeline({
    shader: cullShader,
    entryPoint: 'computeMain',
    shaderLayout: { bindings: CULL_VISIBLE_LINE_BINDINGS },
  })

  return {
    clearShader,
    clearPipeline,
    clearUniformStore,
    clearUniformBuffer,
    cullShader,
    cullPipeline,
    cullUniformStore,
    cullUniformBuffer,
  }
}
