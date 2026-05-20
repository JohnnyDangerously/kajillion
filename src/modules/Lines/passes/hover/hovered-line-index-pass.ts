import { Buffer, Texture, UniformStore, type Device, type Framebuffer } from '@luma.gl/core'
import { Model } from '@luma.gl/engine'
import hoveredLineIndexFrag from '@/graph/modules/Lines/hovered-line-index.frag?raw'
import hoveredLineIndexVert from '@/graph/modules/Lines/hovered-line-index.vert?raw'
import hoveredLineIndexWgsl from '@/graph/modules/Lines/hovered-line-index.wgsl?raw'
import { ensureVec2 } from '@/graph/modules/Shared/uniform-utils'
import { createQuadBufferLayout } from '@/graph/modules/Lines/passes/draw/model-options'
import {
  HOVERED_LINE_INDEX_UNIFORM_TYPES,
  type HoveredLineIndexUniformStoreShape,
} from '@/graph/modules/Lines/passes/hover/contracts'

export type HoveredLineIndexBindingsCache = {
  uniformBindingName: string | undefined;
  uniformBuffer: Buffer | undefined;
  linkIndexTexture: Texture | undefined;
}

type HoveredLineIndexFramebufferResources = {
  texture: Texture;
  framebuffer: Framebuffer;
}

type HoveredLineIndexUniformDefaults = {
  mousePosition: number[] | undefined;
  screenSize: number[] | undefined;
}

type CreateHoveredLineIndexCommandOptions = {
  device: Device;
  quadBuffer: Buffer;
  uniformBindingName: string;
  uniformBuffer: Buffer;
}

type RenderHoveredLineIndexPassOptions = {
  device: Device;
  command: Model;
  framebuffer: Framebuffer;
  uniformStore: UniformStore<HoveredLineIndexUniformStoreShape>;
  uniformBuffer: Buffer | undefined;
  bindingsCache: HoveredLineIndexBindingsCache;
  linkIndexTexture: Texture;
  mousePosition: number[] | undefined;
  screenSize: number[] | undefined;
}

export function createHoveredLineIndexBindingsCache (): HoveredLineIndexBindingsCache {
  return {
    uniformBindingName: undefined,
    uniformBuffer: undefined,
    linkIndexTexture: undefined,
  }
}

export function resetHoveredLineIndexBindingsCache (cache: HoveredLineIndexBindingsCache): void {
  cache.uniformBindingName = undefined
  cache.uniformBuffer = undefined
  cache.linkIndexTexture = undefined
}

export function ensureHoveredLineIndexFramebuffer (
  device: Device,
  existingTexture: Texture | undefined,
  existingFramebuffer: Framebuffer | undefined
): HoveredLineIndexFramebufferResources {
  const texture = existingTexture ?? device.createTexture({
    width: 1,
    height: 1,
    format: 'rgba32float',
    usage: Texture.SAMPLE | Texture.RENDER | Texture.COPY_SRC | Texture.COPY_DST,
    data: new Float32Array(4).fill(0),
  })

  const framebuffer = existingFramebuffer ?? device.createFramebuffer({
    width: 1,
    height: 1,
    colorAttachments: [texture],
  })

  return { texture, framebuffer }
}

export function createHoveredLineIndexUniformStore (
  defaults: HoveredLineIndexUniformDefaults
): UniformStore<HoveredLineIndexUniformStoreShape> {
  return new UniformStore({
    hoveredLineIndexUniforms: {
      uniformTypes: HOVERED_LINE_INDEX_UNIFORM_TYPES,
      defaultUniforms: {
        mousePosition: ensureVec2(defaults.mousePosition, [0, 0]),
        screenSize: ensureVec2(defaults.screenSize, [0, 0]),
      },
    },
  })
}

export function getHoveredLineUniformBindingName (device: Device): string {
  return device.info?.type === 'webgpu' ? 'hoveredLine' : 'hoveredLineIndexUniforms'
}

export function ensureHoveredLineIndexUniformBuffer (
  device: Device,
  uniformStore: UniformStore<HoveredLineIndexUniformStoreShape>,
  existingBuffer: Buffer | undefined
): Buffer {
  if (existingBuffer && !existingBuffer.destroyed) return existingBuffer
  return uniformStore.getManagedUniformBuffer(device, 'hoveredLineIndexUniforms')
}

export function createHoveredLineIndexCommand (options: CreateHoveredLineIndexCommandOptions): Model {
  return new Model(options.device, {
    source: hoveredLineIndexWgsl,
    vs: hoveredLineIndexVert,
    fs: hoveredLineIndexFrag,
    topology: 'triangle-strip',
    colorAttachmentFormats: ['rgba32float'],
    vertexCount: 4,
    attributes: {
      vertexCoord: options.quadBuffer,
    },
    bufferLayout: createQuadBufferLayout(),
    defines: {
      USE_UNIFORM_BUFFERS: true,
    },
    bindings: {
      [options.uniformBindingName]: options.uniformBuffer,
    },
  })
}

export function bindHoveredLineCommandIfNeeded (
  command: Model,
  cache: HoveredLineIndexBindingsCache,
  uniformBindingName: string,
  uniformBuffer: Buffer,
  linkIndexTexture: Texture
): void {
  if (
    cache.uniformBindingName === uniformBindingName &&
    cache.uniformBuffer === uniformBuffer &&
    cache.linkIndexTexture === linkIndexTexture
  ) {
    return
  }

  command.setBindings({
    [uniformBindingName]: uniformBuffer,
    linkIndexTexture,
  })
  cache.uniformBindingName = uniformBindingName
  cache.uniformBuffer = uniformBuffer
  cache.linkIndexTexture = linkIndexTexture
}

export function renderHoveredLineIndexPass (options: RenderHoveredLineIndexPassOptions): Buffer {
  options.uniformStore.setUniforms({
    hoveredLineIndexUniforms: {
      mousePosition: ensureVec2(options.mousePosition, [0, 0]),
      screenSize: ensureVec2(options.screenSize, [0, 0]),
    },
  })

  const uniformBindingName = getHoveredLineUniformBindingName(options.device)
  const uniformBuffer = ensureHoveredLineIndexUniformBuffer(
    options.device,
    options.uniformStore,
    options.uniformBuffer
  )

  bindHoveredLineCommandIfNeeded(
    options.command,
    options.bindingsCache,
    uniformBindingName,
    uniformBuffer,
    options.linkIndexTexture
  )

  const hoverPass = options.device.beginRenderPass({
    framebuffer: options.framebuffer,
  })
  options.command.draw(hoverPass)
  hoverPass.end()

  return uniformBuffer
}
