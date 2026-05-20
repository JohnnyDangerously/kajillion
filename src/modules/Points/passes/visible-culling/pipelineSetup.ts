import type { Device } from '@luma.gl/core'
import { cullVisiblePointsComputeWgsl } from '@/graph/modules/Points/cull-visible-points.compute.wgsl'
import { prefixVisiblePointsComputeWgsl } from '@/graph/modules/Points/prefix-visible-points.compute.wgsl'
import { clearVisiblePointTileBudgetComputeWgsl } from '@/graph/modules/Points/clear-visible-point-tile-budget.compute.wgsl'
import type { VisiblePointCullPipelineState } from './pipelines'

export function ensureVisiblePointCullComputePipelines (
  device: Device,
  state: VisiblePointCullPipelineState,
): void {
  state.cullShader ||= device.createShader({
    stage: 'compute',
    source: cullVisiblePointsComputeWgsl(),
  })
  state.cullPipeline ||= device.createComputePipeline({
    shader: state.cullShader,
    entryPoint: 'countMain',
    shaderLayout: {
      bindings: [
        { type: 'uniform', name: 'cullUniforms', group: 0, location: 0 },
        { type: 'storage', name: 'positions', group: 0, location: 1 },
        { type: 'storage', name: 'sizes', group: 0, location: 2 },
        { type: 'storage', name: 'activeMask', group: 0, location: 5 },
        { type: 'storage', name: 'pointStatusBuf', group: 0, location: 6 },
        { type: 'storage', name: 'visibleGroupOffsets', group: 0, location: 7 },
        { type: 'storage', name: 'visibleMask', group: 0, location: 8 },
        { type: 'storage', name: 'previousPositions', group: 0, location: 9 },
        { type: 'storage', name: 'tileBudgetPriorities', group: 0, location: 10 },
      ],
    },
  })
  state.selectTileBudgetPipeline ||= device.createComputePipeline({
    shader: state.cullShader,
    entryPoint: 'selectTileBudgetMain',
    shaderLayout: {
      bindings: [
        { type: 'uniform', name: 'cullUniforms', group: 0, location: 0 },
        { type: 'storage', name: 'positions', group: 0, location: 1 },
        { type: 'storage', name: 'sizes', group: 0, location: 2 },
        { type: 'storage', name: 'activeMask', group: 0, location: 5 },
        { type: 'storage', name: 'pointStatusBuf', group: 0, location: 6 },
        { type: 'storage', name: 'previousPositions', group: 0, location: 9 },
        { type: 'storage', name: 'tileBudgetPriorities', group: 0, location: 10 },
      ],
    },
  })
  state.scatterPipeline ||= device.createComputePipeline({
    shader: state.cullShader,
    entryPoint: 'scatterMain',
    shaderLayout: {
      bindings: [
        { type: 'uniform', name: 'cullUniforms', group: 0, location: 0 },
        { type: 'storage', name: 'visibleIndices', group: 0, location: 3 },
        { type: 'storage', name: 'visibleGroupOffsets', group: 0, location: 7 },
        { type: 'storage', name: 'visibleMask', group: 0, location: 8 },
      ],
    },
  })
}

export function ensureVisiblePointTileBudgetPipeline (
  device: Device,
  state: VisiblePointCullPipelineState,
): void {
  state.clearTileBudgetShader ||= device.createShader({
    stage: 'compute',
    source: clearVisiblePointTileBudgetComputeWgsl(),
  })
  state.clearTileBudgetPipeline ||= device.createComputePipeline({
    shader: state.clearTileBudgetShader,
    entryPoint: 'computeMain',
    shaderLayout: {
      bindings: [
        { type: 'storage', name: 'tileBudgetPriorities', group: 0, location: 0 },
      ],
    },
  })
}

export function ensureVisiblePointPrefixPipelines (
  device: Device,
  state: VisiblePointCullPipelineState,
): void {
  state.prefixShader ||= device.createShader({
    stage: 'compute',
    source: prefixVisiblePointsComputeWgsl(),
  })
  state.prefixGroupsPipeline ||= device.createComputePipeline({
    shader: state.prefixShader,
    entryPoint: 'scanGroupsMain',
    shaderLayout: {
      bindings: [
        { type: 'storage', name: 'visibleGroupOffsets', group: 0, location: 0 },
        { type: 'storage', name: 'blockSums', group: 0, location: 1 },
      ],
    },
  })
  state.prefixBlocksPipeline ||= device.createComputePipeline({
    shader: state.prefixShader,
    entryPoint: 'scanBlocksMain',
    shaderLayout: {
      bindings: [
        { type: 'storage', name: 'blockSums', group: 0, location: 1 },
        { type: 'storage', name: 'blockOffsets', group: 0, location: 2 },
        { type: 'storage', name: 'indirectArgs', group: 0, location: 3 },
      ],
    },
  })
  state.addBlockOffsetsPipeline ||= device.createComputePipeline({
    shader: state.prefixShader,
    entryPoint: 'addBlockOffsetsMain',
    shaderLayout: {
      bindings: [
        { type: 'storage', name: 'visibleGroupOffsets', group: 0, location: 0 },
        { type: 'storage', name: 'blockOffsets', group: 0, location: 2 },
      ],
    },
  })
}
