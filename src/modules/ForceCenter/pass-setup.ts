import type {
  Buffer,
  Device,
  RenderPipelineParameters,
  UniformStore,
} from '@luma.gl/core'
import { Model } from '@luma.gl/engine'

import calculateCentermassFrag from '@/graph/modules/ForceCenter/calculate-centermass.frag?raw'
import calculateCentermassVert from '@/graph/modules/ForceCenter/calculate-centermass.vert?raw'
import calculateCentermassWgsl from '@/graph/modules/ForceCenter/calculate-centermass.wgsl?raw'
import forceFrag from '@/graph/modules/ForceCenter/force-center.frag?raw'
import forceCenterWgsl from '@/graph/modules/ForceCenter/force-center.wgsl?raw'
import updateVert from '@/graph/modules/Shared/quad.vert?raw'

import type {
  CalculateCentermassUniformStoreShape,
  ForceCenterUniformStoreShape,
} from './contracts'

export function createCalculateCentermassCommand (options: {
  device: Device;
  pointIndices: Buffer | undefined;
  uniformStore: UniformStore<CalculateCentermassUniformStoreShape>;
}): Model {
  return new Model(options.device, {
    source: calculateCentermassWgsl,
    fs: calculateCentermassFrag,
    vs: calculateCentermassVert,
    topology: 'point-list',
    colorAttachmentFormats: ['rgba32float'],
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

export function createForceCenterCommand (options: {
  device: Device;
  vertexCoordBuffer: Buffer;
  uniformStore: UniformStore<ForceCenterUniformStoreShape>;
}): Model {
  return new Model(options.device, {
    source: forceCenterWgsl,
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
      forceCenterUniforms: options.uniformStore.getManagedUniformBuffer(options.device, 'forceCenterUniforms'),
    },
    parameters: {
      depthWriteEnabled: false,
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
