import { Texture, UniformStore, type Buffer, type Device, type Framebuffer } from '@luma.gl/core'
import { Model } from '@luma.gl/engine'
import type { Mat4Array } from '@/graph/modules/Store'
import { ensureVec2 } from '@/graph/modules/Shared/uniform-utils'
import drawDensityImpostorsWgsl from '@/graph/modules/Points/draw-density-impostors.wgsl?raw'
import compositeDensityImpostorsWgsl from '@/graph/modules/Points/composite-density-impostors.wgsl?raw'
import { destroyResource } from '@/graph/modules/Points/passes/resources/lifecycle'
import type {
  DensityCompositeUniforms,
  DensityImpostorUniforms,
} from '@/graph/modules/Points/passes/impostors/contracts'

export type DensityTargetState = {
  texture: Texture;
  framebuffer: Framebuffer;
  size: [number, number];
}

export type DensityRenderState = {
  impostorCommand: Model;
  compositeCommand: Model;
  impostorUniformStore: UniformStore<DensityImpostorUniforms>;
  compositeUniformStore: UniformStore<DensityCompositeUniforms>;
}

export function ensureDensityImpostorTarget (options: {
  device: Device;
  texture: Texture | undefined;
  framebuffer: Framebuffer | undefined;
  size: [number, number] | undefined;
  screenSize: [number, number] | undefined;
  ratio: number;
  densityScale: number;
}): DensityTargetState {
  const width = Math.max(1, Math.ceil((options.screenSize?.[0] ?? 1) * options.ratio / options.densityScale))
  const height = Math.max(1, Math.ceil((options.screenSize?.[1] ?? 1) * options.ratio / options.densityScale))
  if (
    options.texture &&
    options.framebuffer &&
    !options.texture.destroyed &&
    !options.framebuffer.destroyed &&
    options.size?.[0] === width &&
    options.size?.[1] === height
  ) {
    return { texture: options.texture, framebuffer: options.framebuffer, size: options.size }
  }

  destroyResource(options.framebuffer)
  destroyResource(options.texture)
  const texture = options.device.createTexture({
    width,
    height,
    format: 'rgba16float',
    usage: Texture.RENDER | Texture.SAMPLE,
  })
  const framebuffer = options.device.createFramebuffer({
    width,
    height,
    colorAttachments: [texture],
  })
  return { texture, framebuffer, size: [width, height] }
}

export function ensureDensityImpostorRenderCommands (options: {
  device: Device;
  impostorCommand: Model | undefined;
  compositeCommand: Model | undefined;
  impostorUniformStore: UniformStore<DensityImpostorUniforms> | undefined;
  compositeUniformStore: UniformStore<DensityCompositeUniforms> | undefined;
  quadVertexBuffer: Buffer;
  sizeBuffer: Buffer | undefined;
  colorBuffer: Buffer | undefined;
  ratio: number;
  transformationMatrix: Mat4Array;
  spaceSize: number;
  screenSize: [number, number] | undefined;
  sizeScale: number;
  pointOpacity: number;
  maxPointSize: number;
  densityPointSizeScale: number;
  pointCount: number;
  sampleCount: number;
  compositeStrength: number;
}): DensityRenderState {
  const impostorUniformStore = options.impostorUniformStore ?? new UniformStore({
    densityUniforms: {
      uniformTypes: {
        ratio: 'f32',
        transformationMatrix: 'mat4x4<f32>',
        spaceSize: 'f32',
        screenSize: 'vec2<f32>',
        sizeScale: 'f32',
        pointOpacity: 'f32',
        maxPointSize: 'f32',
        densityPointSizeScale: 'f32',
      },
      defaultUniforms: {
        ratio: options.ratio,
        transformationMatrix: options.transformationMatrix,
        spaceSize: options.spaceSize,
        screenSize: ensureVec2(options.screenSize, [0, 0]),
        sizeScale: options.sizeScale,
        pointOpacity: options.pointOpacity,
        maxPointSize: options.maxPointSize,
        densityPointSizeScale: options.densityPointSizeScale,
      },
    },
  })
  const impostorCommand = options.impostorCommand ?? new Model(options.device, {
    source: drawDensityImpostorsWgsl,
    topology: 'triangle-strip',
    colorAttachmentFormats: ['rgba16float'],
    vertexCount: 4,
    instanceCount: options.pointCount,
    attributes: {
      quadCorner: options.quadVertexBuffer,
      ...(options.sizeBuffer && { size: options.sizeBuffer }),
      ...(options.colorBuffer && { color: options.colorBuffer }),
    },
    bufferLayout: [
      { name: 'quadCorner', format: 'float32x2' },
      { name: 'size', format: 'float32', stepMode: 'instance' },
      { name: 'color', format: 'float32x4', stepMode: 'instance' },
    ],
    defines: { USE_UNIFORM_BUFFERS: true },
    bindings: {
      densityUniforms: impostorUniformStore.getManagedUniformBuffer(options.device, 'densityUniforms'),
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
      sampleCount: 1,
    },
  })

  const compositeUniformStore = options.compositeUniformStore ?? new UniformStore({
    compositeUniforms: {
      uniformTypes: { strength: 'f32', opacity: 'f32' },
      defaultUniforms: {
        strength: options.compositeStrength,
        opacity: options.pointOpacity,
      },
    },
  })
  const compositeCommand = options.compositeCommand ?? new Model(options.device, {
    source: compositeDensityImpostorsWgsl,
    topology: 'triangle-strip',
    colorAttachmentFormats: ['bgra8unorm'],
    vertexCount: 4,
    attributes: { quadCorner: options.quadVertexBuffer },
    bufferLayout: [{ name: 'quadCorner', format: 'float32x2' }],
    defines: { USE_UNIFORM_BUFFERS: true },
    bindings: {
      compositeUniforms: compositeUniformStore.getManagedUniformBuffer(options.device, 'compositeUniforms'),
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

  return { impostorCommand, compositeCommand, impostorUniformStore, compositeUniformStore }
}
