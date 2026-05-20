import type { Buffer, Device, UniformStore } from '@luma.gl/core'
import { Model } from '@luma.gl/engine'
import type { GraphData } from '@/graph/modules/GraphData'
import { drawCulledPointsWgsl } from '@/graph/modules/Points/draw-culled-points.wgsl'
import drawHighlightedFrag from '@/graph/modules/Points/draw-highlighted.frag?raw'
import drawHighlightedVert from '@/graph/modules/Points/draw-highlighted.vert?raw'
import drawHighlightedWgsl from '@/graph/modules/Points/draw-highlighted.wgsl?raw'
import drawPointsFrag from '@/graph/modules/Points/draw-points.frag?raw'
import drawPointsVert from '@/graph/modules/Points/draw-points.vert?raw'
import { drawPointsWgsl } from '@/graph/modules/Points/shaders/draw-points.wgsl'
import type {
  DrawHighlightedUniforms,
  PointDrawUniforms,
} from '@/graph/modules/Points/passes/draw/contracts'

export type CreatePointDrawCommandOptions = {
  device: Device;
  uniformStore: UniformStore<PointDrawUniforms>;
  quadVertexBuffer: Buffer | undefined;
  pointIndices: Buffer | undefined;
  sizeBuffer: Buffer | undefined;
  colorBuffer: Buffer | undefined;
  shapeBuffer: Buffer | undefined;
  imageIndicesBuffer: Buffer | undefined;
  imageSizesBuffer: Buffer | undefined;
  data: GraphData;
  sampleCount: number;
  isWebGPU: boolean;
}

export type CreateHighlightedPointDrawCommandOptions = {
  device: Device;
  uniformStore: UniformStore<DrawHighlightedUniforms>;
  vertexCoordBuffer: Buffer;
  sampleCount: number;
}

export type CreateCulledPointDrawCommandOptions = {
  device: Device;
  uniformStore: UniformStore<PointDrawUniforms>;
  quadVertexBuffer: Buffer;
  sampleCount: number;
}

export function createPointDrawCommand (
  options: CreatePointDrawCommandOptions
): Model {
  const { isWebGPU } = options
  return new Model(options.device, {
    source: drawPointsWgsl,
    fs: drawPointsFrag,
    vs: drawPointsVert,
    topology: isWebGPU ? 'triangle-strip' : 'point-list',
    colorAttachmentFormats: ['bgra8unorm'],
    vertexCount: isWebGPU ? 4 : (options.data.pointsNumber ?? 0),
    instanceCount: isWebGPU ? (options.data.pointsNumber ?? 0) : undefined,
    attributes: {
      ...(isWebGPU && options.quadVertexBuffer && { quadCorner: options.quadVertexBuffer }),
      ...(options.pointIndices && { pointIndices: options.pointIndices }),
      ...(options.sizeBuffer && { size: options.sizeBuffer }),
      ...(options.colorBuffer && { color: options.colorBuffer }),
      ...(options.shapeBuffer && { shape: options.shapeBuffer }),
      ...(options.imageIndicesBuffer && { imageIndex: options.imageIndicesBuffer }),
      ...(options.imageSizesBuffer && { imageSize: options.imageSizesBuffer }),
    },
    bufferLayout: isWebGPU
      ? [
        { name: 'quadCorner', format: 'float32x2' },
        { name: 'pointIndices', format: 'float32x2', stepMode: 'instance' },
        { name: 'size', format: 'float32', stepMode: 'instance' },
        { name: 'color', format: 'float32x4', stepMode: 'instance' },
        { name: 'shape', format: 'float32', stepMode: 'instance' },
        { name: 'imageIndex', format: 'float32', stepMode: 'instance' },
        { name: 'imageSize', format: 'float32', stepMode: 'instance' },
      ]
      : [
        { name: 'pointIndices', format: 'float32x2' },
        { name: 'size', format: 'float32' },
        { name: 'color', format: 'float32x4' },
        { name: 'shape', format: 'float32' },
        { name: 'imageIndex', format: 'float32' },
        { name: 'imageSize', format: 'float32' },
      ],
    defines: {
      USE_UNIFORM_BUFFERS: true,
    },
    bindings: {
      drawVertexUniforms: options.uniformStore.getManagedUniformBuffer(options.device, 'drawVertexUniforms'),
      drawFragmentUniforms: options.uniformStore.getManagedUniformBuffer(options.device, 'drawFragmentUniforms'),
    },
    parameters: createPointDrawParameters(options.sampleCount),
  })
}

export function createHighlightedPointDrawCommand (
  options: CreateHighlightedPointDrawCommandOptions
): Model {
  return new Model(options.device, {
    source: drawHighlightedWgsl,
    fs: drawHighlightedFrag,
    vs: drawHighlightedVert,
    topology: 'triangle-strip',
    colorAttachmentFormats: ['bgra8unorm'],
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
      drawHighlightedUniforms: options.uniformStore.getManagedUniformBuffer(
        options.device,
        'drawHighlightedUniforms'
      ),
    },
    parameters: {
      blend: true,
      blendColorOperation: 'add',
      blendColorSrcFactor: 'src-alpha',
      blendColorDstFactor: 'one-minus-src-alpha',
      blendAlphaOperation: 'add',
      blendAlphaSrcFactor: 'one',
      blendAlphaDstFactor: 'one-minus-src-alpha',
      depthWriteEnabled: false,
      sampleCount: options.sampleCount,
    },
  })
}

export function createCulledPointDrawCommand (
  options: CreateCulledPointDrawCommandOptions
): Model {
  return new Model(options.device, {
    source: drawCulledPointsWgsl,
    topology: 'triangle-strip',
    colorAttachmentFormats: ['bgra8unorm'],
    vertexCount: 4,
    instanceCount: 0,
    attributes: {
      quadCorner: options.quadVertexBuffer,
    },
    bufferLayout: [
      { name: 'quadCorner', format: 'float32x2' },
    ],
    defines: {
      USE_UNIFORM_BUFFERS: true,
    },
    bindings: {
      drawVertexUniforms: options.uniformStore.getManagedUniformBuffer(options.device, 'drawVertexUniforms'),
      drawFragmentUniforms: options.uniformStore.getManagedUniformBuffer(options.device, 'drawFragmentUniforms'),
    },
    parameters: createPointDrawParameters(options.sampleCount),
  })
}

function createPointDrawParameters (sampleCount: number): Record<string, unknown> {
  return {
    blend: true,
    blendColorOperation: 'add',
    blendColorSrcFactor: 'one',
    blendColorDstFactor: 'one-minus-src-alpha',
    blendAlphaOperation: 'add',
    blendAlphaSrcFactor: 'one',
    blendAlphaDstFactor: 'one-minus-src-alpha',
    depthWriteEnabled: false,
    sampleCount,
  }
}
