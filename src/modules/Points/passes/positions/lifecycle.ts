import { Buffer, Texture, type Device } from '@luma.gl/core'
import { destroyResource } from '@/graph/modules/Points/passes/resources/lifecycle'
import { ensureRgba32FloatTarget, type PositionTargetState } from './rgba-target'

export type { PositionTargetState } from './rgba-target'

export type PositionStorageBufferState = {
  positionStorageBuffer: Buffer | undefined;
  previousRenderPositionStorageBuffer: Buffer | undefined;
  positionStorageBufferTextureSize: number;
}

export function createInitialPositionState (
  pointPositions: Float32Array | number[],
  pointsNumber: number,
  pointsTextureSize: number
): Float32Array {
  const textureDataSize = pointsTextureSize * pointsTextureSize * 4
  const initialState = new Float32Array(textureDataSize)
  const expectedBytes = textureDataSize * Float32Array.BYTES_PER_ELEMENT
  const actualBytes = initialState.byteLength

  if (actualBytes !== expectedBytes) {
    console.error('Texture data size mismatch:', {
      pointsTextureSize,
      expectedBytes,
      actualBytes,
      textureDataSize,
      dataLength: initialState.length,
    })
  }

  for (let i = 0; i < pointsNumber; ++i) {
    initialState[i * 4 + 0] = pointPositions[i * 2 + 0] as number
    initialState[i * 4 + 1] = pointPositions[i * 2 + 1] as number
    initialState[i * 4 + 2] = i
  }

  return initialState
}

export function ensurePositionTarget (
  device: Device,
  state: PositionTargetState,
  pointsTextureSize: number,
  data: Float32Array,
  usage: number
): PositionTargetState {
  return ensureRgba32FloatTarget(device, state, pointsTextureSize, data, usage)
}

export function ensureVelocityTarget (
  device: Device,
  state: PositionTargetState,
  pointsTextureSize: number
): PositionTargetState {
  const velocityData = new Float32Array(pointsTextureSize * pointsTextureSize * 4).fill(0)
  return ensureRgba32FloatTarget(
    device,
    state,
    pointsTextureSize,
    velocityData,
    Texture.SAMPLE | Texture.STORAGE | Texture.RENDER | Texture.COPY_DST
  )
}

export function ensureSearchTarget (
  device: Device,
  state: PositionTargetState,
  pointsTextureSize: number,
  data: Float32Array
): PositionTargetState {
  return ensureRgba32FloatTarget(
    device,
    state,
    pointsTextureSize,
    data,
    Texture.SAMPLE | Texture.RENDER | Texture.COPY_SRC | Texture.COPY_DST
  )
}

export function ensureHoveredTarget (
  device: Device,
  state: PositionTargetState
): PositionTargetState {
  const texture = state.texture
  if (texture && !texture.destroyed) return state

  destroyResource(state.framebuffer)
  const nextTexture = device.createTexture({
    width: 2,
    height: 2,
    format: 'rgba32float',
    usage: Texture.SAMPLE | Texture.RENDER | Texture.COPY_SRC | Texture.COPY_DST,
  })

  return {
    texture: nextTexture,
    framebuffer: device.createFramebuffer({
      width: 2,
      height: 2,
      colorAttachments: [nextTexture],
    }),
  }
}

export function ensurePositionStorageBuffers (
  device: Device,
  state: PositionStorageBufferState,
  pointsTextureSize: number,
  initialState: Float32Array
): PositionStorageBufferState {
  if (
    device.info?.type !== 'webgpu' ||
    (
      state.positionStorageBuffer &&
      state.previousRenderPositionStorageBuffer &&
      state.positionStorageBufferTextureSize === pointsTextureSize
    )
  ) {
    return state
  }

  destroyResource(state.positionStorageBuffer)
  destroyResource(state.previousRenderPositionStorageBuffer)

  const byteLength = pointsTextureSize * pointsTextureSize * 16
  const positionStorageBuffer = device.createBuffer({
    byteLength,
    usage: Buffer.STORAGE | Buffer.COPY_DST | Buffer.COPY_SRC,
  })
  const previousRenderPositionStorageBuffer = device.createBuffer({
    byteLength,
    usage: Buffer.STORAGE | Buffer.COPY_DST,
  })
  const initialBytes = new Uint8Array(initialState.buffer, initialState.byteOffset, initialState.byteLength)
  positionStorageBuffer.write(initialBytes)
  previousRenderPositionStorageBuffer.write(initialBytes)

  return {
    positionStorageBuffer,
    previousRenderPositionStorageBuffer,
    positionStorageBufferTextureSize: pointsTextureSize,
  }
}
