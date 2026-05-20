import type {
  BindingDeclaration,
  Buffer,
  ComputePipeline,
  Device,
  RenderPipelineParameters,
  Shader,
  UniformStore,
} from '@luma.gl/core'
import { Model } from '@luma.gl/engine'

import calculateLevelFrag from '@/graph/modules/ForceManyBody/calculate-level.frag?raw'
import calculateLevelVert from '@/graph/modules/ForceManyBody/calculate-level.vert?raw'
import calculateLevelWgsl from '@/graph/modules/ForceManyBody/calculate-level.wgsl?raw'
import forceFrag from '@/graph/modules/ForceManyBody/force-level.frag?raw'
import forceLevelWgsl from '@/graph/modules/ForceManyBody/force-level.wgsl?raw'
import forceCenterFrag from '@/graph/modules/ForceManyBody/force-centermass.frag?raw'
import forceCentermassWgsl from '@/graph/modules/ForceManyBody/force-centermass.wgsl?raw'
import { forceManyBodyComputeWgsl } from '@/graph/modules/ForceManyBody/force-many-body.compute.wgsl'
import updateVert from '@/graph/modules/Shared/quad.vert?raw'

import type {
  CalculateLevelsUniformStoreShape,
  ForceCenterUniformStoreShape,
  ForceUniformStoreShape,
} from './contracts'

export function createCalculateLevelsCommand (options: {
  device: Device;
  vertexCount: number;
  pointIndices: Buffer | undefined;
  uniformStore: UniformStore<CalculateLevelsUniformStoreShape>;
}): Model {
  return new Model(options.device, {
    source: calculateLevelWgsl,
    fs: calculateLevelFrag,
    vs: calculateLevelVert,
    topology: 'point-list',
    colorAttachmentFormats: ['rgba32float'],
    vertexCount: options.vertexCount,
    attributes: {
      ...options.pointIndices && { pointIndices: options.pointIndices },
    },
    bufferLayout: [
      { name: 'pointIndices', format: 'float32x2' },
    ],
    defines: {
      USE_UNIFORM_BUFFERS: true,
    },
    bindings: {
      calculateLevelsUniforms: options.uniformStore.getManagedUniformBuffer(options.device, 'calculateLevelsUniforms'),
    },
    parameters: getAdditiveBlendParameters(),
  })
}

export function createForceCommand (options: {
  device: Device;
  vertexCoordBuffer: Buffer;
  uniformStore: UniformStore<ForceUniformStoreShape>;
}): Model {
  return new Model(options.device, {
    source: forceLevelWgsl,
    fs: forceFrag,
    vs: updateVert,
    topology: 'triangle-strip',
    colorAttachmentFormats: ['rgba32float'],
    vertexCount: 4,
    attributes: {
      vertexCoord: options.vertexCoordBuffer,
    },
    bufferLayout: [
      { name: 'vertexCoord', format: 'float32x2' },
    ],
    defines: {
      USE_UNIFORM_BUFFERS: true,
    },
    bindings: {
      forceUniforms: options.uniformStore.getManagedUniformBuffer(options.device, 'forceUniforms'),
    },
    parameters: getAdditiveBlendParameters(),
  })
}

export function createForceCenterCommand (options: {
  device: Device;
  vertexCoordBuffer: Buffer;
  uniformStore: UniformStore<ForceCenterUniformStoreShape>;
}): Model {
  return new Model(options.device, {
    source: forceCentermassWgsl,
    fs: forceCenterFrag,
    vs: updateVert,
    topology: 'triangle-strip',
    colorAttachmentFormats: ['rgba32float'],
    vertexCount: 4,
    attributes: {
      vertexCoord: options.vertexCoordBuffer,
    },
    bufferLayout: [
      { name: 'vertexCoord', format: 'float32x2' },
    ],
    defines: {
      USE_UNIFORM_BUFFERS: true,
    },
    bindings: {
      forceCenterUniforms: options.uniformStore.getManagedUniformBuffer(options.device, 'forceCenterUniforms'),
    },
    parameters: getAdditiveBlendParameters(),
  })
}

export function createForceComputeShader (device: Device, levels: number): Shader {
  return device.createShader({
    stage: 'compute',
    source: forceManyBodyComputeWgsl(levels),
  })
}

export function createForceComputePipeline (
  device: Device,
  shader: Shader,
  levels: number
): ComputePipeline {
  return device.createComputePipeline({
    shader,
    entryPoint: 'computeMain',
    shaderLayout: { bindings: createForceComputeBindingDeclarations(levels) },
  })
}

function createForceComputeBindingDeclarations (levels: number): BindingDeclaration[] {
  const bindings: BindingDeclaration[] = [
    { type: 'uniform', name: 'forceComputeUniforms', group: 0, location: 0 },
    { type: 'texture', name: 'positionsTexture', group: 0, location: 1 },
    { type: 'texture', name: 'randomValues', group: 0, location: 2 },
    { type: 'storage', name: 'velocityOut', group: 0, location: 3 },
  ]
  for (let i = 0; i < levels; i += 1) {
    bindings.push({ type: 'texture' as const, name: `levelFbo${i}`, group: 0, location: 4 + i })
  }
  return bindings
}

function getAdditiveBlendParameters (): RenderPipelineParameters {
  return {
    blend: true,
    blendColorOperation: 'add',
    blendColorSrcFactor: 'one',
    blendColorDstFactor: 'one',
    blendAlphaOperation: 'add',
    blendAlphaSrcFactor: 'one',
    blendAlphaDstFactor: 'one',
    depthWriteEnabled: false,
  }
}
