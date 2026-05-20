import { UniformStore, type Buffer, type Device, type Framebuffer, type Texture } from '@luma.gl/core'
import { Model } from '@luma.gl/engine'
import { ensureVec2 } from '@/graph/modules/Shared/uniform-utils'
import { createFullscreenQuadBuffer } from '@/graph/modules/Points/passes/resources/lifecycle'
import dragPointFrag from '@/graph/modules/Points/drag-point.frag?raw'
import dragPointWgsl from '@/graph/modules/Points/drag-point.wgsl?raw'
import updateVert from '@/graph/modules/Shared/quad.vert?raw'
import type { DragPointUniforms } from '@/graph/modules/Points/passes/draw/contracts'

export type DragPointRenderState = {
  command: Model | undefined;
  uniformStore: UniformStore<DragPointUniforms> | undefined;
  vertexCoordBuffer: Buffer | undefined;
}

export type EnsureDragPointRenderOptions = DragPointRenderState & {
  device: Device;
  mousePosition: number[] | undefined;
  hoveredPointIndex: number;
}

export type RunDragPointRenderOptions = {
  device: Device;
  command: Model | undefined;
  uniformStore: UniformStore<DragPointUniforms> | undefined;
  currentPositionFbo: Framebuffer | undefined;
  previousPositionTexture: Texture | undefined;
  mousePosition: number[] | undefined;
  hoveredPointIndex: number;
}

export function ensureDragPointRenderCommand (
  options: EnsureDragPointRenderOptions
): DragPointRenderState {
  const vertexCoordBuffer = options.vertexCoordBuffer ?? createFullscreenQuadBuffer(options.device)
  const uniformStore = options.uniformStore ?? new UniformStore({
    dragPointUniforms: {
      uniformTypes: {
        // Order MUST match shader declaration order (std140 layout)
        mousePos: 'vec2<f32>',
        index: 'f32',
      },
      defaultUniforms: {
        mousePos: ensureVec2(options.mousePosition, [0, 0]),
        index: options.hoveredPointIndex,
      },
    },
  })
  const command = options.command ?? new Model(options.device, {
    source: dragPointWgsl,
    fs: dragPointFrag,
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
      dragPointUniforms: uniformStore.getManagedUniformBuffer(options.device, 'dragPointUniforms'),
    },
  })

  return { command, uniformStore, vertexCoordBuffer }
}

export function runDragPointRender (options: RunDragPointRenderOptions): boolean {
  const {
    device,
    command,
    uniformStore,
    currentPositionFbo,
    previousPositionTexture,
    mousePosition,
    hoveredPointIndex,
  } = options
  if (!command || !uniformStore || !currentPositionFbo || currentPositionFbo.destroyed) return false
  if (!previousPositionTexture || previousPositionTexture.destroyed) return false

  uniformStore.setUniforms({
    dragPointUniforms: {
      mousePos: ensureVec2(mousePosition, [0, 0]),
      index: hoveredPointIndex,
    },
  })
  command.setBindings({
    positionsTexture: previousPositionTexture,
  })

  const renderPass = device.beginRenderPass({
    framebuffer: currentPositionFbo,
  })
  command.draw(renderPass)
  renderPass.end()
  return true
}
