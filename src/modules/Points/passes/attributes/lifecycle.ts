import { Buffer, type Device, type Texture } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import type { GraphData } from '@/graph/modules/GraphData'
import { getBytesPerRow } from '@/graph/modules/Shared/texture-utils'
import {
  writeOrCreateBuffer,
  writeOrCreateTexture,
} from '@/graph/modules/Points/passes/resources/lifecycle'

type AttributeCommand = Pick<Model, 'setAttributes'>

export function updatePointColorBuffer (
  device: Device,
  data: GraphData,
  pointsTextureSize: number | undefined,
  colorBuffer: Buffer | undefined,
  drawCommand: AttributeCommand | undefined
): Buffer | undefined {
  if (!pointsTextureSize) return colorBuffer

  const nextColorBuffer = writeOrCreateBuffer(
    device,
    colorBuffer,
    data.pointColors as Float32Array,
    Buffer.VERTEX | Buffer.COPY_DST | Buffer.STORAGE
  )
  drawCommand?.setAttributes({ color: nextColorBuffer })
  return nextColorBuffer
}

export type PointSizeAttributeState = {
  sizeBuffer: Buffer | undefined;
  sizeTexture: Texture | undefined;
}

export function updatePointSizeAttributes (
  device: Device,
  data: GraphData,
  pointsTextureSize: number | undefined,
  state: PointSizeAttributeState,
  drawCommand: AttributeCommand | undefined
): PointSizeAttributeState {
  if (!pointsTextureSize || data.pointsNumber === undefined || data.pointSizes === undefined) return state

  const sizeBuffer = writeOrCreateBuffer(
    device,
    state.sizeBuffer,
    data.pointSizes,
    Buffer.VERTEX | Buffer.COPY_DST | Buffer.STORAGE
  )
  drawCommand?.setAttributes({ size: sizeBuffer })

  const initialState = new Float32Array(pointsTextureSize * pointsTextureSize * 4)
  for (let i = 0; i < data.pointsNumber; i++) {
    const shapeSize = data.pointSizes[i] as number
    const imageSize = data.pointImageSizes?.[i] ?? shapeSize
    initialState[i * 4] = Math.max(shapeSize, imageSize)
  }

  const sizeTexture = writeOrCreateTexture(device, state.sizeTexture, {
    width: pointsTextureSize,
    height: pointsTextureSize,
    format: 'rgba32float',
  }, {
    data: initialState,
    bytesPerRow: getBytesPerRow('rgba32float', pointsTextureSize),
    mipLevel: 0,
    x: 0,
    y: 0,
  })

  return { sizeBuffer, sizeTexture }
}

export type PointShapeAttributeState = {
  shapeBuffer: Buffer | undefined;
  hasNonCircleShapes: boolean;
}

export function updatePointShapeBuffer (
  device: Device,
  data: GraphData,
  state: PointShapeAttributeState,
  drawCommand: AttributeCommand | undefined
): PointShapeAttributeState {
  if (data.pointsNumber === undefined || data.pointShapes === undefined) return state

  const shapeData = data.pointShapes
  let hasNonCircleShapes = false
  for (const value of shapeData) {
    if (value !== 0) {
      hasNonCircleShapes = true
      break
    }
  }

  const shapeBuffer = writeOrCreateBuffer(device, state.shapeBuffer, shapeData, Buffer.VERTEX | Buffer.COPY_DST)
  drawCommand?.setAttributes({ shape: shapeBuffer })
  return { shapeBuffer, hasNonCircleShapes }
}

export function updatePointImageIndexBuffer (
  device: Device,
  data: GraphData,
  imageIndicesBuffer: Buffer | undefined,
  drawCommand: AttributeCommand | undefined
): Buffer | undefined {
  if (data.pointsNumber === undefined || data.pointImageIndices === undefined) return imageIndicesBuffer

  const nextImageIndicesBuffer = writeOrCreateBuffer(
    device,
    imageIndicesBuffer,
    data.pointImageIndices,
    Buffer.VERTEX | Buffer.COPY_DST
  )
  drawCommand?.setAttributes({ imageIndex: nextImageIndicesBuffer })
  return nextImageIndicesBuffer
}

export function updatePointImageSizeBuffer (
  device: Device,
  data: GraphData,
  imageSizesBuffer: Buffer | undefined,
  drawCommand: AttributeCommand | undefined,
  findHoveredPointCommand: AttributeCommand | undefined
): Buffer | undefined {
  if (data.pointsNumber === undefined || data.pointImageSizes === undefined) return imageSizesBuffer

  const nextImageSizesBuffer = writeOrCreateBuffer(
    device,
    imageSizesBuffer,
    data.pointImageSizes,
    Buffer.VERTEX | Buffer.COPY_DST
  )
  drawCommand?.setAttributes({ imageSize: nextImageSizesBuffer })
  findHoveredPointCommand?.setAttributes({ imageSize: nextImageSizesBuffer })
  return nextImageSizesBuffer
}
