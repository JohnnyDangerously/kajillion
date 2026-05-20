import type { Buffer, Device, RenderPipelineParameters, UniformStore } from '@luma.gl/core'
import { Model } from '@luma.gl/engine'

import calculateCentermassFrag from '@/graph/modules/Clusters/calculate-centermass.frag?raw'
import calculateCentermassVert from '@/graph/modules/Clusters/calculate-centermass.vert?raw'
import calculateCentermassWgsl from '@/graph/modules/Clusters/calculate-centermass.wgsl?raw'
import forceFrag from '@/graph/modules/Clusters/force-cluster.frag?raw'
import forceClusterWgsl from '@/graph/modules/Clusters/force-cluster.wgsl?raw'
import updateVert from '@/graph/modules/Shared/quad.vert?raw'

import type {
  ApplyForcesUniformStoreShape,
  CalculateCentermassUniformStoreShape,
} from './contracts'

export function createCalculateCentermassCommand (options: {
  device: Device;
  vertexCount: number;
  pointIndices: Buffer | undefined;
  uniformStore: UniformStore<CalculateCentermassUniformStoreShape>;
}): Model {
  return new Model(options.device, {
    source: calculateCentermassWgsl,
    fs: calculateCentermassFrag,
    vs: calculateCentermassVert,
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
      calculateCentermassUniforms: options.uniformStore.getManagedUniformBuffer(options.device, 'calculateCentermassUniforms'),
    },
    parameters: getAdditiveBlendParameters(),
  })
}

export function createApplyForcesCommand (options: {
  device: Device;
  vertexCoordBuffer: Buffer;
  uniformStore: UniformStore<ApplyForcesUniformStoreShape>;
}): Model {
  return new Model(options.device, {
    source: forceClusterWgsl,
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
      applyForcesUniforms: options.uniformStore.getManagedUniformBuffer(options.device, 'applyForcesUniforms'),
    },
  })
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
