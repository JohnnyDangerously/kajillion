import { Buffer, Texture, type Device, type Framebuffer } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import { createIndexesForBuffer } from '@/graph/modules/Shared/buffer'
import {
  createInitialPositionState,
  ensureHoveredTarget,
  ensurePositionStorageBuffers,
  ensurePositionTarget,
  ensureSearchTarget,
  ensureVelocityTarget,
} from '@/graph/modules/Points/passes/positions/lifecycle'
import { writeOrCreateBuffer } from '@/graph/modules/Points/passes/resources/lifecycle'

export type PointPositionResourceState = {
  currentPositionTexture: Texture | undefined;
  currentPositionFbo: Framebuffer | undefined;
  previousPositionTexture: Texture | undefined;
  previousPositionFbo: Framebuffer | undefined;
  velocityTexture: Texture | undefined;
  velocityFbo: Framebuffer | undefined;
  searchTexture: Texture | undefined;
  searchFbo: Framebuffer | undefined;
  hoveredTexture: Texture | undefined;
  hoveredFbo: Framebuffer | undefined;
  positionStorageBuffer: Buffer | undefined;
  previousRenderPositionStorageBuffer: Buffer | undefined;
  positionStorageBufferTextureSize: number;
  drawPointIndices: Buffer | undefined;
  hoveredPointIndices: Buffer | undefined;
  sampledPointIndices: Buffer | undefined;
  isPositionStorageBufferDirty: boolean;
}

export type UpdatePointPositionResourceOptions = {
  device: Device;
  pointPositions: Float32Array;
  pointsNumber: number;
  pointsTextureSize: number;
  enableSimulation: boolean;
  state: PointPositionResourceState;
  drawCommand: Model | undefined;
  fillSampledPointsFboCommand: Model | undefined;
}

export function updatePointPositionResources (
  options: UpdatePointPositionResourceOptions
): PointPositionResourceState {
  const {
    device,
    pointPositions,
    pointsNumber,
    pointsTextureSize,
    enableSimulation,
    drawCommand,
    fillSampledPointsFboCommand,
  } = options
  const next = { ...options.state }
  const initialState = createInitialPositionState(pointPositions, pointsNumber, pointsTextureSize)
  const positionTextureUsage = Texture.TEXTURE | Texture.COPY_DST | Texture.RENDER_ATTACHMENT | Texture.COPY_SRC | Texture.STORAGE

  const currentPositionTarget = ensurePositionTarget(device, {
    texture: next.currentPositionTexture,
    framebuffer: next.currentPositionFbo,
  }, pointsTextureSize, initialState, positionTextureUsage)
  next.currentPositionTexture = currentPositionTarget.texture
  next.currentPositionFbo = currentPositionTarget.framebuffer

  const positionStorageState = ensurePositionStorageBuffers(device, {
    positionStorageBuffer: next.positionStorageBuffer,
    previousRenderPositionStorageBuffer: next.previousRenderPositionStorageBuffer,
    positionStorageBufferTextureSize: next.positionStorageBufferTextureSize,
  }, pointsTextureSize, initialState)
  next.positionStorageBuffer = positionStorageState.positionStorageBuffer
  next.previousRenderPositionStorageBuffer = positionStorageState.previousRenderPositionStorageBuffer
  next.positionStorageBufferTextureSize = positionStorageState.positionStorageBufferTextureSize
  if (device.info?.type === 'webgpu') next.isPositionStorageBufferDirty = true

  const previousPositionTarget = ensurePositionTarget(device, {
    texture: next.previousPositionTexture,
    framebuffer: next.previousPositionFbo,
  }, pointsTextureSize, initialState, positionTextureUsage)
  next.previousPositionTexture = previousPositionTarget.texture
  next.previousPositionFbo = previousPositionTarget.framebuffer

  if (enableSimulation) {
    const velocityTarget = ensureVelocityTarget(device, {
      texture: next.velocityTexture,
      framebuffer: next.velocityFbo,
    }, pointsTextureSize)
    next.velocityTexture = velocityTarget.texture
    next.velocityFbo = velocityTarget.framebuffer
  }

  const searchTarget = ensureSearchTarget(device, {
    texture: next.searchTexture,
    framebuffer: next.searchFbo,
  }, pointsTextureSize, initialState)
  next.searchTexture = searchTarget.texture
  next.searchFbo = searchTarget.framebuffer

  const hoveredTarget = ensureHoveredTarget(device, {
    texture: next.hoveredTexture,
    framebuffer: next.hoveredFbo,
  })
  next.hoveredTexture = hoveredTarget.texture
  next.hoveredFbo = hoveredTarget.framebuffer

  const indexData = createIndexesForBuffer(pointsTextureSize)
  next.drawPointIndices = writeOrCreateBuffer(device, next.drawPointIndices, indexData, Buffer.VERTEX | Buffer.COPY_DST)
  drawCommand?.setAttributes({ pointIndices: next.drawPointIndices })

  next.hoveredPointIndices = writeOrCreateBuffer(device, next.hoveredPointIndices, indexData, Buffer.VERTEX | Buffer.COPY_DST)
  next.sampledPointIndices = writeOrCreateBuffer(device, next.sampledPointIndices, indexData, Buffer.VERTEX | Buffer.COPY_DST)
  fillSampledPointsFboCommand?.setAttributes({ pointIndices: next.sampledPointIndices })

  return next
}
