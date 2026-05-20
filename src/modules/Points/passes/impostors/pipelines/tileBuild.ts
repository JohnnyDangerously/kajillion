import { UniformStore, type Buffer, type ComputePipeline, type Device, type Shader } from '@luma.gl/core'
import { ensureVec2 } from '@/graph/modules/Shared/uniform-utils'
import { clearTileImpostorsComputeWgsl } from '@/graph/modules/Points/clear-tile-impostors.compute.wgsl'
import { binTileImpostorsComputeWgsl } from '@/graph/modules/Points/bin-tile-impostors.compute.wgsl'
import { resolveTileImpostorsComputeWgsl } from '@/graph/modules/Points/resolve-tile-impostors.compute.wgsl'
import type { Mat4Array } from '@/graph/modules/Store'
import type { TileImpostorUniforms } from '@/graph/modules/Points/passes/impostors/contracts'

export type TileImpostorBuildPipelineState = {
  uniformStore: UniformStore<TileImpostorUniforms> | undefined;
  uniformBuffer: Buffer | undefined;
  clearPipeline: ComputePipeline | undefined;
  clearShader: Shader | undefined;
  binPipeline: ComputePipeline | undefined;
  binShader: Shader | undefined;
  resolvePipeline: ComputePipeline | undefined;
  resolveShader: Shader | undefined;
}

export type TileImpostorBuildPipelineOptions = {
  device: Device;
  state: TileImpostorBuildPipelineState;
  ratio: number;
  transformationMatrix: Mat4Array;
  spaceSize: number;
  screenSize: [number, number] | undefined;
  tileSize: number;
  pointCount: number;
  tileColumns: number;
  tileRows: number;
  buildSampleRate: number;
  buildSampleWeight: number;
}

export function ensureTileImpostorBuildPipelines (
  options: TileImpostorBuildPipelineOptions
): TileImpostorBuildPipelineState {
  const state = { ...options.state }
  state.uniformStore ||= new UniformStore({
    tileUniforms: {
      uniformTypes: {
        ratio: 'f32',
        transformationMatrix: 'mat4x4<f32>',
        spaceSize: 'f32',
        screenSize: 'vec2<f32>',
        tileSize: 'f32',
        pointCount: 'u32',
        tileColumns: 'u32',
        tileRows: 'u32',
        colorScale: 'u32',
        positionScale: 'u32',
        buildSampleRate: 'f32',
        buildSampleWeight: 'u32',
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
        colorScale: 1024,
        positionScale: 1024,
        buildSampleRate: options.buildSampleRate,
        buildSampleWeight: options.buildSampleWeight,
      },
    },
  })
  state.uniformBuffer ||= state.uniformStore.getManagedUniformBuffer(options.device, 'tileUniforms')

  state.clearShader ||= options.device.createShader({
    stage: 'compute',
    source: clearTileImpostorsComputeWgsl(),
  })
  state.clearPipeline ||= options.device.createComputePipeline({
    shader: state.clearShader,
    entryPoint: 'computeMain',
    shaderLayout: {
      bindings: [
        { type: 'uniform', name: 'tileUniforms', group: 0, location: 0 },
        { type: 'storage', name: 'atomicTiles', group: 0, location: 1 },
        { type: 'storage', name: 'resolvedTiles', group: 0, location: 2 },
      ],
    },
  })

  state.binShader ||= options.device.createShader({
    stage: 'compute',
    source: binTileImpostorsComputeWgsl(),
  })
  state.binPipeline ||= options.device.createComputePipeline({
    shader: state.binShader,
    entryPoint: 'computeMain',
    shaderLayout: {
      bindings: [
        { type: 'uniform', name: 'tileUniforms', group: 0, location: 0 },
        { type: 'storage', name: 'positions', group: 0, location: 1 },
        { type: 'storage', name: 'colors', group: 0, location: 2 },
        { type: 'storage', name: 'atomicTiles', group: 0, location: 3 },
      ],
    },
  })

  state.resolveShader ||= options.device.createShader({
    stage: 'compute',
    source: resolveTileImpostorsComputeWgsl(),
  })
  state.resolvePipeline ||= options.device.createComputePipeline({
    shader: state.resolveShader,
    entryPoint: 'computeMain',
    shaderLayout: {
      bindings: [
        { type: 'uniform', name: 'tileUniforms', group: 0, location: 0 },
        { type: 'storage', name: 'atomicTiles', group: 0, location: 1 },
        { type: 'storage', name: 'resolvedTiles', group: 0, location: 2 },
      ],
    },
  })

  return state
}
