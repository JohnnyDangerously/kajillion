import { Model } from '@luma.gl/engine'
import findPointsInPolygonFrag from '@/graph/modules/Points/find-points-in-polygon.frag?raw'
import findPointsInPolygonWgsl from '@/graph/modules/Points/find-points-in-polygon.wgsl?raw'
import findPointsInRectFrag from '@/graph/modules/Points/find-points-in-rect.frag?raw'
import findPointsInRectWgsl from '@/graph/modules/Points/find-points-in-rect.wgsl?raw'
import updateVert from '@/graph/modules/Shared/quad.vert?raw'
import { createFullscreenQuadBuffer } from '@/graph/modules/Points/passes/resources/lifecycle'

import type { PointSearchSetupOptions, PointSearchSetupState } from './contracts'
import {
  createFillSampledPointsUniformStore,
  createFindHoveredPointUniformStore,
  createFindPointsInPolygonUniformStore,
  createFindPointsInRectUniformStore,
} from './uniform-stores'
export {
  ensureFillSampledPointsSetup,
  ensureFindHoveredPointSetup,
} from './pointCommands'

type RectSetupState = Pick<
  PointSearchSetupState,
  'findPointsInRectCommand' | 'findPointsInRectUniformStore' | 'findPointsInRectVertexCoordBuffer'
>

type PolygonSetupState = Pick<
  PointSearchSetupState,
  | 'findPointsInPolygonCommand'
  | 'findPointsInPolygonUniformStore'
  | 'findPointsInPolygonVertexCoordBuffer'
>

export function ensureFindPointsInRectSetup (options: PointSearchSetupOptions): RectSetupState {
  const findPointsInRectVertexCoordBuffer =
    options.findPointsInRectVertexCoordBuffer ?? createFullscreenQuadBuffer(options.device)
  const findPointsInRectUniformStore =
    options.findPointsInRectUniformStore ?? createFindPointsInRectUniformStore(options)
  const findPointsInRectCommand = options.findPointsInRectCommand ?? new Model(options.device, {
    source: findPointsInRectWgsl,
    fs: findPointsInRectFrag,
    vs: updateVert,
    topology: 'triangle-strip',
    colorAttachmentFormats: ['rgba32float'],
    vertexCount: 4,
    attributes: {
      vertexCoord: findPointsInRectVertexCoordBuffer,
    },
    bufferLayout: [
      { name: 'vertexCoord', format: 'float32x2' },
    ],
    defines: {
      USE_UNIFORM_BUFFERS: true,
    },
    bindings: {
      findPointsInRectUniforms: findPointsInRectUniformStore.getManagedUniformBuffer(
        options.device,
        'findPointsInRectUniforms'
      ),
    },
  })

  return {
    findPointsInRectCommand,
    findPointsInRectUniformStore,
    findPointsInRectVertexCoordBuffer,
  }
}

export function ensureFindPointsInPolygonSetup (options: PointSearchSetupOptions): PolygonSetupState {
  const findPointsInPolygonVertexCoordBuffer =
    options.findPointsInPolygonVertexCoordBuffer ?? createFullscreenQuadBuffer(options.device)
  const findPointsInPolygonUniformStore =
    options.findPointsInPolygonUniformStore ?? createFindPointsInPolygonUniformStore(options)
  const findPointsInPolygonCommand = options.findPointsInPolygonCommand ?? new Model(options.device, {
    source: findPointsInPolygonWgsl,
    fs: findPointsInPolygonFrag,
    vs: updateVert,
    topology: 'triangle-strip',
    colorAttachmentFormats: ['rgba32float'],
    vertexCount: 4,
    attributes: {
      vertexCoord: findPointsInPolygonVertexCoordBuffer,
    },
    bufferLayout: [
      { name: 'vertexCoord', format: 'float32x2' },
    ],
    defines: {
      USE_UNIFORM_BUFFERS: true,
    },
    bindings: {
      findPointsInPolygonUniforms: findPointsInPolygonUniformStore.getManagedUniformBuffer(
        options.device,
        'findPointsInPolygonUniforms'
      ),
    },
  })

  return {
    findPointsInPolygonCommand,
    findPointsInPolygonUniformStore,
    findPointsInPolygonVertexCoordBuffer,
  }
}
