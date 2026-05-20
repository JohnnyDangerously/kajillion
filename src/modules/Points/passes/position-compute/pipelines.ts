import { UniformStore, type Buffer, type ComputePipeline, type Device, type Shader } from '@luma.gl/core'
import { syncPositionStorageWgsl } from '@/graph/modules/Points/sync-position-storage.compute.wgsl'
import { updatePositionComputeWgsl } from '@/graph/modules/Points/update-position.compute.wgsl'
import { dragPointComputeWgsl } from '@/graph/modules/Points/drag-point.compute.wgsl'
import type {
  DragPointComputeUniforms,
  SyncPositionUniforms,
  UpdatePositionComputeUniforms,
} from '@/graph/modules/Points/passes/draw/contracts'

export type SyncPositionPipelineState = {
  pipeline: ComputePipeline | undefined;
  shader: Shader | undefined;
  uniformStore: UniformStore<SyncPositionUniforms> | undefined;
  uniformBuffer: Buffer | undefined;
}

export type UpdatePositionComputePipelineState = {
  pipeline: ComputePipeline | undefined;
  shader: Shader | undefined;
  uniformStore: UniformStore<UpdatePositionComputeUniforms> | undefined;
  uniformBuffer: Buffer | undefined;
}

export type DragPointComputePipelineState = {
  pipeline: ComputePipeline | undefined;
  shader: Shader | undefined;
  uniformStore: UniformStore<DragPointComputeUniforms> | undefined;
  uniformBuffer: Buffer | undefined;
}

export function ensureSyncPositionPipeline (
  device: Device,
  state: SyncPositionPipelineState
): SyncPositionPipelineState {
  if (device.info?.type !== 'webgpu' || state.pipeline) return state

  const uniformStore = state.uniformStore ?? new UniformStore({
    syncPositionUniforms: {
      uniformTypes: { pointCount: 'u32', textureSize: 'u32' },
    },
  })
  const uniformBuffer = state.uniformBuffer ?? uniformStore.getManagedUniformBuffer(device, 'syncPositionUniforms')
  const shader = state.shader ?? device.createShader({
    stage: 'compute',
    source: syncPositionStorageWgsl(),
  })
  const pipeline = device.createComputePipeline({
    shader,
    entryPoint: 'computeMain',
    shaderLayout: {
      bindings: [
        { type: 'uniform', name: 'syncPositionUniforms', group: 0, location: 0 },
        { type: 'texture', name: 'positionsTexture', group: 0, location: 1 },
        { type: 'storage', name: 'positionsBuf', group: 0, location: 2 },
      ],
    },
  })

  return { pipeline, shader, uniformStore, uniformBuffer }
}

export function ensureUpdatePositionComputePipeline (
  device: Device,
  state: UpdatePositionComputePipelineState
): UpdatePositionComputePipelineState {
  if (device.info?.type !== 'webgpu' || state.pipeline) return state

  const uniformStore = state.uniformStore ?? new UniformStore({
    updatePositionUniforms: {
      uniformTypes: {
        friction: 'f32',
        spaceSize: 'f32',
        pointCount: 'u32',
        textureSize: 'u32',
      },
    },
  })
  const uniformBuffer = state.uniformBuffer ?? uniformStore.getManagedUniformBuffer(device, 'updatePositionUniforms')
  const shader = state.shader ?? device.createShader({
    stage: 'compute',
    source: updatePositionComputeWgsl(),
  })
  const pipeline = device.createComputePipeline({
    shader,
    entryPoint: 'computeMain',
    shaderLayout: {
      bindings: [
        { type: 'uniform', name: 'updatePositionUniforms', group: 0, location: 0 },
        { type: 'texture', name: 'previousPositions', group: 0, location: 1 },
        { type: 'texture', name: 'velocity', group: 0, location: 2 },
        { type: 'texture', name: 'pinnedStatusTexture', group: 0, location: 3 },
        { type: 'storage', name: 'positionsOut', group: 0, location: 4 },
        { type: 'storage', name: 'positionsBuf', group: 0, location: 5 },
      ],
    },
  })

  return { pipeline, shader, uniformStore, uniformBuffer }
}

export function ensureDragPointComputePipeline (
  device: Device,
  state: DragPointComputePipelineState
): DragPointComputePipelineState {
  if (device.info?.type !== 'webgpu' || state.pipeline) return state

  const uniformStore = state.uniformStore ?? new UniformStore({
    dragPointUniforms: {
      uniformTypes: {
        mousePos: 'vec2<f32>',
        index: 'f32',
        pointCount: 'u32',
        textureSize: 'u32',
      },
    },
  })
  const uniformBuffer = state.uniformBuffer ?? uniformStore.getManagedUniformBuffer(device, 'dragPointUniforms')
  const shader = state.shader ?? device.createShader({
    stage: 'compute',
    source: dragPointComputeWgsl(),
  })
  const pipeline = device.createComputePipeline({
    shader,
    entryPoint: 'computeMain',
    shaderLayout: {
      bindings: [
        { type: 'uniform', name: 'dragPointUniforms', group: 0, location: 0 },
        { type: 'texture', name: 'previousPositions', group: 0, location: 1 },
        { type: 'storage', name: 'positionsOut', group: 0, location: 2 },
        { type: 'storage', name: 'positionsBuf', group: 0, location: 3 },
      ],
    },
  })

  return { pipeline, shader, uniformStore, uniformBuffer }
}
