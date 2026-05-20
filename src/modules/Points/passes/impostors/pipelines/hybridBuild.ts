import { UniformStore, type Buffer, type ComputePipeline, type Device, type Shader } from '@luma.gl/core'
import { ensureVec2 } from '@/graph/modules/Shared/uniform-utils'
import { clearHybridAnchorsComputeWgsl } from '@/graph/modules/Points/clear-hybrid-anchors.compute.wgsl'
import { fillHybridAnchorsComputeWgsl } from '@/graph/modules/Points/fill-hybrid-anchors.compute.wgsl'
import { materializeHybridAnchorsComputeWgsl } from '@/graph/modules/Points/materialize-hybrid-anchors.compute.wgsl'
import type { Mat4Array } from '@/graph/modules/Store'
import type { HybridAnchorBuildUniforms } from '@/graph/modules/Points/passes/impostors/contracts'

export type HybridAnchorBuildPipelineState = {
  uniformStore: UniformStore<HybridAnchorBuildUniforms> | undefined;
  uniformBuffer: Buffer | undefined;
  clearPipeline: ComputePipeline | undefined;
  clearShader: Shader | undefined;
  fillPipeline: ComputePipeline | undefined;
  fillShader: Shader | undefined;
  materializePipeline: ComputePipeline | undefined;
  materializeShader: Shader | undefined;
}

export type HybridAnchorBuildPipelineOptions = {
  device: Device;
  state: HybridAnchorBuildPipelineState;
  ratio: number;
  transformationMatrix: Mat4Array;
  spaceSize: number;
  screenSize: [number, number] | undefined;
  tileSize: number;
  pointCount: number;
  tileColumns: number;
  tileRows: number;
  anchorsPerTile: number;
  denseSampleRate: number;
  sparseTileThreshold: number;
}

export function ensureHybridAnchorBuildPipelines (
  options: HybridAnchorBuildPipelineOptions
): HybridAnchorBuildPipelineState {
  const state = { ...options.state }
  state.uniformStore ||= new UniformStore({
    hybridAnchorBuildUniforms: {
      uniformTypes: {
        ratio: 'f32',
        transformationMatrix: 'mat4x4<f32>',
        spaceSize: 'f32',
        screenSize: 'vec2<f32>',
        tileSize: 'f32',
        pointCount: 'u32',
        tileColumns: 'u32',
        tileRows: 'u32',
        anchorsPerTile: 'u32',
        denseSampleRate: 'f32',
        sparseTileThreshold: 'f32',
      },
      defaultUniforms: {
        ratio: options.ratio,
        transformationMatrix: options.transformationMatrix,
        spaceSize: options.spaceSize,
        screenSize: ensureVec2(options.screenSize, [0, 0]),
        tileSize: options.tileSize,
        pointCount: options.pointCount,
        tileColumns: options.tileColumns,
        tileRows: options.tileRows,
        anchorsPerTile: options.anchorsPerTile,
        denseSampleRate: options.denseSampleRate,
        sparseTileThreshold: options.sparseTileThreshold,
      },
    },
  })
  state.uniformBuffer ||= state.uniformStore.getManagedUniformBuffer(options.device, 'hybridAnchorBuildUniforms')

  state.clearShader ||= options.device.createShader({
    stage: 'compute',
    source: clearHybridAnchorsComputeWgsl(),
  })
  state.clearPipeline ||= options.device.createComputePipeline({
    shader: state.clearShader,
    entryPoint: 'computeMain',
    shaderLayout: {
      bindings: [
        { type: 'uniform', name: 'anchorUniforms', group: 0, location: 0 },
        { type: 'storage', name: 'anchorCounts', group: 0, location: 1 },
        { type: 'storage', name: 'anchorPositions', group: 0, location: 2 },
        { type: 'storage', name: 'anchorColors', group: 0, location: 3 },
        { type: 'storage', name: 'anchorIndirectArgs', group: 0, location: 4 },
      ],
    },
  })

  state.fillShader ||= options.device.createShader({
    stage: 'compute',
    source: fillHybridAnchorsComputeWgsl(),
  })
  state.fillPipeline ||= options.device.createComputePipeline({
    shader: state.fillShader,
    entryPoint: 'computeMain',
    shaderLayout: {
      bindings: [
        { type: 'uniform', name: 'anchorUniforms', group: 0, location: 0 },
        { type: 'storage', name: 'positions', group: 0, location: 1 },
        { type: 'storage', name: 'sizes', group: 0, location: 3 },
        { type: 'storage', name: 'resolvedTiles', group: 0, location: 4 },
        { type: 'storage', name: 'anchorCounts', group: 0, location: 5 },
      ],
    },
  })

  state.materializeShader ||= options.device.createShader({
    stage: 'compute',
    source: materializeHybridAnchorsComputeWgsl(),
  })
  state.materializePipeline ||= options.device.createComputePipeline({
    shader: state.materializeShader,
    entryPoint: 'computeMain',
    shaderLayout: {
      bindings: [
        { type: 'uniform', name: 'anchorUniforms', group: 0, location: 0 },
        { type: 'storage', name: 'positions', group: 0, location: 1 },
        { type: 'storage', name: 'colors', group: 0, location: 2 },
        { type: 'storage', name: 'sizes', group: 0, location: 3 },
        { type: 'storage', name: 'resolvedTiles', group: 0, location: 4 },
        { type: 'storage', name: 'anchorCounts', group: 0, location: 5 },
        { type: 'storage', name: 'anchorPositions', group: 0, location: 6 },
        { type: 'storage', name: 'anchorColors', group: 0, location: 7 },
        { type: 'storage', name: 'anchorIndirectArgs', group: 0, location: 8 },
      ],
    },
  })

  return state
}
