import { Buffer, type BindingDeclaration, type ComputePipeline, type Device, type Shader, UniformStore } from '@luma.gl/core'
import { Model } from '@luma.gl/engine'

import { forceFrag } from '@/graph/modules/ForceLink/force-spring'
import { forceSpringComputeWgsl } from '@/graph/modules/ForceLink/force-spring.compute.wgsl'
import { forceSpringWgsl } from '@/graph/modules/ForceLink/force-spring.wgsl'
import updateVert from '@/graph/modules/Shared/quad.vert?raw'

import type { ForceLinkSetupContext, ForceLinkState, ForceLinkUniformStoreShape } from './contracts'

export function initForceLinkPrograms (
  context: ForceLinkSetupContext,
  state: ForceLinkState
): void {
  const { device, store, points } = context
  if (!points || !store.pointsTextureSize || !store.linksTextureSize) return
  if (!state.linkFirstIndicesAndAmountTexture || !state.indicesTexture || !state.biasAndStrengthTexture || !state.randomDistanceTexture) return

  state.uniformStore ||= createForceLinkUniformStore()
  state.uniformBuffer ||= state.uniformStore.getManagedUniformBuffer(device, 'forceLinkUniforms')

  if (device.info?.type === 'webgpu') {
    initComputePipeline(device, state)
  } else {
    initFragmentModel(device, state)
  }
}

function createForceLinkUniformStore (): UniformStore<ForceLinkUniformStoreShape> {
  return new UniformStore({
    forceLinkUniforms: {
      uniformTypes: {
        linkSpring: 'f32',
        linkDistance: 'f32',
        linkDistRandomVariationRange: 'vec2<f32>',
        pointsTextureSize: 'f32',
        linksTextureSize: 'f32',
        alpha: 'f32',
      },
    },
  })
}

function initFragmentModel (device: Device, state: ForceLinkState): void {
  state.vertexCoordBuffer ||= device.createBuffer({
    data: new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
  })

  state.runCommand ||= new Model(device, {
    source: forceSpringWgsl(state.maxPointDegree),
    fs: forceFrag(state.maxPointDegree),
    vs: updateVert,
    topology: 'triangle-strip',
    colorAttachmentFormats: ['rgba32float'],
    vertexCount: 4,
    attributes: {
      vertexCoord: state.vertexCoordBuffer,
    },
    bufferLayout: [
      { name: 'vertexCoord', format: 'float32x2' },
    ],
    defines: {
      USE_UNIFORM_BUFFERS: true,
    },
    bindings: {
      forceLinkUniforms: state.uniformBuffer!,
    },
    parameters: {
      depthWriteEnabled: false,
    },
  })
}

function initComputePipeline (device: Device, state: ForceLinkState): void {
  if (state.runComputePipeline) return

  state.runComputeShader = createForceLinkComputeShader(device, state.maxPointDegree)
  state.runComputePipeline = createForceLinkComputePipeline(device, state.runComputeShader)
}

function createForceLinkComputeShader (device: Device, maxPointDegree: number): Shader {
  return device.createShader({
    stage: 'compute',
    source: forceSpringComputeWgsl(maxPointDegree),
  })
}

function createForceLinkComputePipeline (device: Device, shader: Shader): ComputePipeline {
  return device.createComputePipeline({
    shader,
    entryPoint: 'computeMain',
    shaderLayout: {
      bindings: createForceLinkComputeBindingDeclarations(),
    },
  })
}

function createForceLinkComputeBindingDeclarations (): BindingDeclaration[] {
  return [
    { type: 'uniform', name: 'forceLinkUniforms', group: 0, location: 0 },
    { type: 'texture', name: 'positionsTexture', group: 0, location: 1 },
    { type: 'texture', name: 'linkInfoTexture', group: 0, location: 2 },
    { type: 'texture', name: 'linkBundleTexture', group: 0, location: 3 },
    { type: 'storage', name: 'velocityOut', group: 0, location: 4 },
  ]
}
