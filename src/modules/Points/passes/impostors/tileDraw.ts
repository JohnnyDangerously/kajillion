import { UniformStore, type Buffer, type Device } from '@luma.gl/core'
import { Model } from '@luma.gl/engine'
import { ensureVec2 } from '@/graph/modules/Shared/uniform-utils'
import drawTileImpostorsWgsl from '@/graph/modules/Points/draw-tile-impostors.wgsl?raw'
import type { TileRenderUniforms } from '@/graph/modules/Points/passes/impostors/contracts'

export type TileImpostorRenderState = {
  command: Model;
  uniformStore: UniformStore<TileRenderUniforms>;
}

export type TileImpostorRenderOptions = {
  device: Device;
  command: Model | undefined;
  uniformStore: UniformStore<TileRenderUniforms> | undefined;
  quadVertexBuffer: Buffer;
  screenSize: [number, number] | undefined;
  ratio: number;
  tileColumns: number;
  tileRows: number;
  tileSize: number;
  tileCount: number;
  opacity: number;
  strength: number;
  microSplats: number;
  sparseTileThreshold: number;
  massRadiusScale: number;
  massThreshold: number;
  massMaxAlpha: number;
  massColorBoost: number;
  massExtrusion: number;
  sampleCount: number;
}

export function ensureTileImpostorRenderCommand (
  options: TileImpostorRenderOptions
): TileImpostorRenderState {
  const uniformStore = options.uniformStore ?? new UniformStore({
    tileRenderUniforms: {
      uniformTypes: {
        screenSize: 'vec2<f32>',
        ratio: 'f32',
        tileColumns: 'u32',
        tileRows: 'u32',
        tileSize: 'f32',
        opacity: 'f32',
        strength: 'f32',
        microSplats: 'u32',
        sparseTileThreshold: 'f32',
        massRadiusScale: 'f32',
        massThreshold: 'f32',
        massMaxAlpha: 'f32',
        massColorBoost: 'f32',
        massExtrusion: 'f32',
      },
      defaultUniforms: {
        screenSize: ensureVec2(options.screenSize, [0, 0]),
        ratio: options.ratio,
        tileColumns: options.tileColumns,
        tileRows: options.tileRows,
        tileSize: options.tileSize,
        opacity: options.opacity,
        strength: options.strength,
        microSplats: options.microSplats,
        sparseTileThreshold: options.sparseTileThreshold,
        massRadiusScale: options.massRadiusScale,
        massThreshold: options.massThreshold,
        massMaxAlpha: options.massMaxAlpha,
        massColorBoost: options.massColorBoost,
        massExtrusion: options.massExtrusion,
      },
    },
  })

  const command = options.command ?? new Model(options.device, {
    source: drawTileImpostorsWgsl,
    topology: 'triangle-strip',
    colorAttachmentFormats: ['bgra8unorm'],
    vertexCount: 4,
    instanceCount: options.tileCount * options.microSplats,
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
      tileRenderUniforms: uniformStore.getManagedUniformBuffer(options.device, 'tileRenderUniforms'),
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
