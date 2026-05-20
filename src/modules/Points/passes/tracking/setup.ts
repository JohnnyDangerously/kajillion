import { UniformStore, type Buffer, type Device, type Framebuffer, type Texture } from '@luma.gl/core'
import { Model } from '@luma.gl/engine'
import { createFullscreenQuadBuffer } from '@/graph/modules/Points/passes/resources/lifecycle'
import trackPositionsFrag from '@/graph/modules/Points/track-positions.frag?raw'
import trackPositionsWgsl from '@/graph/modules/Points/track-positions.wgsl?raw'
import updateVert from '@/graph/modules/Shared/quad.vert?raw'
import type { TrackPointsUniforms } from '@/graph/modules/Points/passes/draw/contracts'

export type TrackPointsSetupState = {
  command: Model | undefined;
  uniformStore: UniformStore<TrackPointsUniforms> | undefined;
  vertexCoordBuffer: Buffer | undefined;
}

export type EnsureTrackPointsSetupOptions = TrackPointsSetupState & {
  device: Device;
  pointsTextureSize: number;
}

export type RunTrackPointsOptions = {
  device: Device;
  command: Model | undefined;
  uniformStore: UniformStore<TrackPointsUniforms> | undefined;
  trackedPositionsFbo: Framebuffer | undefined;
  currentPositionTexture: Texture | undefined;
  trackedIndicesTexture: Texture | undefined;
  pointsTextureSize: number;
  hasTrackedIndices: boolean;
}

export function ensureTrackPointsSetup (options: EnsureTrackPointsSetupOptions): TrackPointsSetupState {
  const vertexCoordBuffer = options.vertexCoordBuffer ?? createFullscreenQuadBuffer(options.device)
  const uniformStore = options.uniformStore ?? new UniformStore({
    trackPointsUniforms: {
      uniformTypes: {
        // Order MUST match shader declaration order (std140 layout)
        pointsTextureSize: 'f32',
      },
      defaultUniforms: {
        pointsTextureSize: options.pointsTextureSize,
      },
    },
  })
  const command = options.command ?? new Model(options.device, {
    source: trackPositionsWgsl,
    fs: trackPositionsFrag,
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
      trackPointsUniforms: uniformStore.getManagedUniformBuffer(options.device, 'trackPointsUniforms'),
    },
  })

  return { command, uniformStore, vertexCoordBuffer }
}

export function runTrackPoints (options: RunTrackPointsOptions): boolean {
  const {
    device,
    command,
    uniformStore,
    trackedPositionsFbo,
    currentPositionTexture,
    trackedIndicesTexture,
    pointsTextureSize,
    hasTrackedIndices,
  } = options
  if (!hasTrackedIndices || !command || !uniformStore || !trackedPositionsFbo || trackedPositionsFbo.destroyed) return false
  if (!currentPositionTexture || currentPositionTexture.destroyed) return false
  if (!trackedIndicesTexture || trackedIndicesTexture.destroyed) return false

  uniformStore.setUniforms({
    trackPointsUniforms: { pointsTextureSize },
  })
  command.setBindings({
    positionsTexture: currentPositionTexture,
    trackedIndices: trackedIndicesTexture,
  })

  const renderPass = device.beginRenderPass({
    framebuffer: trackedPositionsFbo,
  })
  command.draw(renderPass)
  renderPass.end()
  return true
}
