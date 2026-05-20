import { UniformStore, type Buffer, type Device } from '@luma.gl/core'
import { Model } from '@luma.gl/engine'
import type { Mat4Array } from '@/graph/modules/Store'
import { ensureVec2 } from '@/graph/modules/Shared/uniform-utils'
import drawCompactedAnchorPointsWgsl from '@/graph/modules/Points/draw-compacted-anchor-points.wgsl?raw'
import drawHybridAnchorPointsWgsl from '@/graph/modules/Points/draw-hybrid-anchor-points.wgsl?raw'
import type {
  CompactedAnchorUniforms,
  HybridAnchorUniforms,
} from '@/graph/modules/Points/passes/impostors/contracts'

export type CompactedAnchorRenderState = {
  command: Model;
  uniformStore: UniformStore<CompactedAnchorUniforms>;
}

export type HybridAnchorRenderState = {
  command: Model;
  uniformStore: UniformStore<HybridAnchorUniforms>;
}

type SharedAnchorOptions = {
  device: Device;
  quadVertexBuffer: Buffer;
  ratio: number;
  screenSize: [number, number] | undefined;
  pointSizeScale: number;
  denseOpacity: number;
  sparseOpacity: number;
  maxPointSize: number;
  sampleCount: number;
}

export function ensureCompactedAnchorRenderCommand (
  options: SharedAnchorOptions & {
    command: Model | undefined;
    uniformStore: UniformStore<CompactedAnchorUniforms> | undefined;
    hybridAnchorCapacity: number;
  }
): CompactedAnchorRenderState {
  const uniformStore = options.uniformStore ?? new UniformStore({
    compactedAnchorUniforms: {
      uniformTypes: {
        screenSize: 'vec2<f32>',
        ratio: 'f32',
        pointSizeScale: 'f32',
        denseOpacity: 'f32',
        sparseOpacity: 'f32',
        maxPointSize: 'f32',
      },
      defaultUniforms: {
        screenSize: ensureVec2(options.screenSize, [0, 0]),
        ratio: options.ratio,
        pointSizeScale: options.pointSizeScale,
        denseOpacity: options.denseOpacity,
        sparseOpacity: options.sparseOpacity,
        maxPointSize: options.maxPointSize,
      },
    },
  })

  const command = options.command ?? new Model(options.device, {
    source: drawCompactedAnchorPointsWgsl,
    topology: 'triangle-strip',
    colorAttachmentFormats: ['bgra8unorm'],
    vertexCount: 4,
    instanceCount: options.hybridAnchorCapacity,
    attributes: { quadCorner: options.quadVertexBuffer },
    bufferLayout: [{ name: 'quadCorner', format: 'float32x2' }],
    defines: { USE_UNIFORM_BUFFERS: true },
    bindings: {
      compactedAnchorUniforms: uniformStore.getManagedUniformBuffer(options.device, 'compactedAnchorUniforms'),
    },
    parameters: {
      blend: true,
      blendColorOperation: 'add',
      blendColorSrcFactor: 'one',
      blendColorDstFactor: 'one',
      blendAlphaOperation: 'add',
      blendAlphaSrcFactor: 'one',
      blendAlphaDstFactor: 'one',
      depthWriteEnabled: false,
      sampleCount: options.sampleCount,
    },
  })

  return { command, uniformStore }
}

export function ensureHybridAnchorRenderCommand (
  options: SharedAnchorOptions & {
    command: Model | undefined;
    uniformStore: UniformStore<HybridAnchorUniforms> | undefined;
    transformationMatrix: Mat4Array;
    spaceSize: number;
    tileSize: number;
    tileColumns: number;
    tileRows: number;
    denseSampleRate: number;
    sparseTileThreshold: number;
    pointCount: number;
  }
): HybridAnchorRenderState {
  const uniformStore = options.uniformStore ?? new UniformStore({
    hybridAnchorUniforms: {
      uniformTypes: {
        ratio: 'f32',
        transformationMatrix: 'mat4x4<f32>',
        spaceSize: 'f32',
        screenSize: 'vec2<f32>',
        tileSize: 'f32',
        tileColumns: 'u32',
        tileRows: 'u32',
        pointSizeScale: 'f32',
        denseSampleRate: 'f32',
        denseOpacity: 'f32',
        sparseOpacity: 'f32',
        sparseTileThreshold: 'f32',
        maxPointSize: 'f32',
      },
      defaultUniforms: {
        ratio: options.ratio,
        transformationMatrix: options.transformationMatrix,
        spaceSize: options.spaceSize,
        screenSize: ensureVec2(options.screenSize, [0, 0]),
        tileSize: options.tileSize,
        tileColumns: options.tileColumns,
        tileRows: options.tileRows,
        pointSizeScale: options.pointSizeScale,
        denseSampleRate: options.denseSampleRate,
        denseOpacity: options.denseOpacity,
        sparseOpacity: options.sparseOpacity,
        sparseTileThreshold: options.sparseTileThreshold,
        maxPointSize: options.maxPointSize,
      },
    },
  })

  const command = options.command ?? new Model(options.device, {
    source: drawHybridAnchorPointsWgsl,
    topology: 'triangle-strip',
    colorAttachmentFormats: ['bgra8unorm'],
    vertexCount: 4,
    instanceCount: options.pointCount,
    attributes: { quadCorner: options.quadVertexBuffer },
    bufferLayout: [{ name: 'quadCorner', format: 'float32x2' }],
    defines: { USE_UNIFORM_BUFFERS: true },
    bindings: {
      hybridAnchorUniforms: uniformStore.getManagedUniformBuffer(options.device, 'hybridAnchorUniforms'),
    },
    parameters: {
      blend: true,
      blendColorOperation: 'add',
      blendColorSrcFactor: 'one',
      blendColorDstFactor: 'one-minus-src-alpha',
      blendAlphaOperation: 'add',
      blendAlphaSrcFactor: 'one',
      blendAlphaDstFactor: 'one-minus-src-alpha',
      depthWriteEnabled: false,
      sampleCount: options.sampleCount,
    },
  })

  return { command, uniformStore }
}
