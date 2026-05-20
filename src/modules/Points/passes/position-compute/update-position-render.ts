import { UniformStore, type Buffer, type Device, type Framebuffer, type Texture } from '@luma.gl/core'
import { Model } from '@luma.gl/engine'
import { createFullscreenQuadBuffer } from '@/graph/modules/Points/passes/resources/lifecycle'
import updatePositionFrag from '@/graph/modules/Points/update-position.frag?raw'
import updatePositionWgsl from '@/graph/modules/Points/update-position.wgsl?raw'
import updateVert from '@/graph/modules/Shared/quad.vert?raw'
import type { UpdatePositionUniforms } from '@/graph/modules/Points/passes/draw/contracts'

export type UpdatePositionRenderState = {
  command: Model | undefined;
  uniformStore: UniformStore<UpdatePositionUniforms> | undefined;
  vertexCoordBuffer: Buffer | undefined;
}

export type EnsureUpdatePositionRenderOptions = UpdatePositionRenderState & {
  device: Device;
  friction: number;
  spaceSize: number;
}

export type RunUpdatePositionRenderOptions = {
  device: Device;
  command: Model | undefined;
  uniformStore: UniformStore<UpdatePositionUniforms> | undefined;
  currentPositionFbo: Framebuffer | undefined;
  previousPositionTexture: Texture | undefined;
  velocityTexture: Texture | undefined;
  pinnedStatusTexture: Texture | undefined;
  friction: number;
  spaceSize: number;
}

export function ensureUpdatePositionRenderCommand (
  options: EnsureUpdatePositionRenderOptions
): UpdatePositionRenderState {
  const vertexCoordBuffer = options.vertexCoordBuffer ?? createFullscreenQuadBuffer(options.device)
  const uniformStore = options.uniformStore ?? new UniformStore({
    updatePositionUniforms: {
      uniformTypes: {
        // Order MUST match shader declaration order (std140 layout)
        friction: 'f32',
        spaceSize: 'f32',
      },
      defaultUniforms: {
        friction: options.friction,
        spaceSize: options.spaceSize,
      },
    },
  })
  const command = options.command ?? new Model(options.device, {
    // Dual-backend: source (WGSL) used on WebGPU device, vs/fs (GLSL) on WebGL2.
    source: updatePositionWgsl,
    fs: updatePositionFrag,
    vs: updateVert,
    topology: 'triangle-strip',
    colorAttachmentFormats: ['rgba32float'],
    vertexCount: 4,
    attributes: {
      vertexCoord: vertexCoordBuffer,
    },
    bufferLayout: [
      { name: 'vertexCoord', format: 'float32x2' },
    ],
    defines: {
      USE_UNIFORM_BUFFERS: true,
    },
    bindings: {
      updatePositionUniforms: uniformStore.getManagedUniformBuffer(options.device, 'updatePositionUniforms'),
    },
  })

  return { command, uniformStore, vertexCoordBuffer }
}

export function runUpdatePositionRender (options: RunUpdatePositionRenderOptions): boolean {
  const {
    device,
    command,
    uniformStore,
    currentPositionFbo,
    previousPositionTexture,
    velocityTexture,
    pinnedStatusTexture,
    friction,
    spaceSize,
  } = options
  if (!command || !uniformStore || !currentPositionFbo || currentPositionFbo.destroyed) return false
  if (!previousPositionTexture || previousPositionTexture.destroyed) return false
  if (!velocityTexture || velocityTexture.destroyed) return false
  if (!pinnedStatusTexture || pinnedStatusTexture.destroyed) return false

  uniformStore.setUniforms({
    updatePositionUniforms: { friction, spaceSize },
  })
  command.setBindings({
    positionsTexture: previousPositionTexture,
    velocity: velocityTexture,
    pinnedStatusTexture,
  })

  const renderPass = device.beginRenderPass({
    framebuffer: currentPositionFbo,
  })
  command.draw(renderPass)
  renderPass.end()
  return true
}
