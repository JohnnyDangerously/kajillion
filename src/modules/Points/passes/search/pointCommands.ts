import { Model } from '@luma.gl/engine'
import findHoveredPointFrag from '@/graph/modules/Points/find-hovered-point.frag?raw'
import findHoveredPointVert from '@/graph/modules/Points/find-hovered-point.vert?raw'
import findHoveredPointWgsl from '@/graph/modules/Points/find-hovered-point.wgsl?raw'
import fillGridWithSampledPointsFrag from '@/graph/modules/Points/fill-sampled-points.frag?raw'
import fillGridWithSampledPointsVert from '@/graph/modules/Points/fill-sampled-points.vert?raw'
import fillGridWithSampledPointsWgsl from '@/graph/modules/Points/fill-sampled-points.wgsl?raw'
import type { PointSearchSetupOptions, PointSearchSetupState } from './contracts'
import {
  createFillSampledPointsUniformStore,
  createFindHoveredPointUniformStore,
} from './uniform-stores'

type HoveredSetupState = Pick<
  PointSearchSetupState,
  'findHoveredPointCommand' | 'findHoveredPointUniformStore'
>

type SampledSetupState = Pick<
  PointSearchSetupState,
  'fillSampledPointsFboCommand' | 'fillSampledPointsUniformStore'
>

export function ensureFindHoveredPointSetup (options: PointSearchSetupOptions): HoveredSetupState {
  const findHoveredPointUniformStore =
    options.findHoveredPointUniformStore ?? createFindHoveredPointUniformStore(options)
  const findHoveredPointCommand = options.findHoveredPointCommand ?? new Model(options.device, {
    source: findHoveredPointWgsl,
    fs: findHoveredPointFrag,
    vs: findHoveredPointVert,
    topology: 'point-list',
    colorAttachmentFormats: ['rgba32float'],
    vertexCount: options.data.pointsNumber ?? 0,
    attributes: {
      ...(options.hoveredPointIndices && { pointIndices: options.hoveredPointIndices }),
      ...(options.sizeBuffer && { size: options.sizeBuffer }),
      ...(options.imageSizesBuffer && { imageSize: options.imageSizesBuffer }),
    },
    bufferLayout: [
      { name: 'pointIndices', format: 'float32x2' },
      { name: 'size', format: 'float32' },
      { name: 'imageSize', format: 'float32' },
    ],
    defines: {
      USE_UNIFORM_BUFFERS: true,
    },
    bindings: {
      findHoveredPointUniforms: findHoveredPointUniformStore.getManagedUniformBuffer(
        options.device,
        'findHoveredPointUniforms'
      ),
    },
    parameters: {
      depthWriteEnabled: false,
      blend: false,
    },
  })

  return {
    findHoveredPointCommand,
    findHoveredPointUniformStore,
  }
}

export function ensureFillSampledPointsSetup (options: PointSearchSetupOptions): SampledSetupState {
  const fillSampledPointsUniformStore =
    options.fillSampledPointsUniformStore ?? createFillSampledPointsUniformStore(options)
  const fillSampledPointsFboCommand = options.fillSampledPointsFboCommand ?? new Model(options.device, {
    source: fillGridWithSampledPointsWgsl,
    fs: fillGridWithSampledPointsFrag,
    vs: fillGridWithSampledPointsVert,
    topology: 'point-list',
    colorAttachmentFormats: ['rgba32float'],
    vertexCount: options.data.pointsNumber ?? 0,
    attributes: {
      ...(options.sampledPointIndices && { pointIndices: options.sampledPointIndices }),
    },
    bufferLayout: [
      { name: 'pointIndices', format: 'float32x2' },
    ],
    defines: {
      USE_UNIFORM_BUFFERS: true,
    },
    bindings: {
      fillSampledPointsUniforms: fillSampledPointsUniformStore.getManagedUniformBuffer(
        options.device,
        'fillSampledPointsUniforms'
      ),
    },
    parameters: {
      depthWriteEnabled: false,
    },
  })

  return {
    fillSampledPointsFboCommand,
    fillSampledPointsUniformStore,
  }
}
