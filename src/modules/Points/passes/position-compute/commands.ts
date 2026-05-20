import type { Buffer, ComputePipeline, Device, Texture, UniformStore } from '@luma.gl/core'
import type {
  DragPointComputeUniforms,
  SyncPositionUniforms,
  UpdatePositionComputeUniforms,
} from '@/graph/modules/Points/passes/draw/contracts'

export type SyncPositionStorageComputeOptions = {
  device: Device;
  pipeline: ComputePipeline | undefined;
  uniformStore: UniformStore<SyncPositionUniforms> | undefined;
  uniformBuffer: Buffer | undefined;
  currentPositionTexture: Texture | undefined;
  positionStorageBuffer: Buffer | undefined;
  pointCount: number;
  textureSize: number;
}

export function runSyncPositionStorageCompute (options: SyncPositionStorageComputeOptions): boolean {
  const {
    device,
    pipeline,
    uniformStore,
    uniformBuffer,
    currentPositionTexture,
    positionStorageBuffer,
    pointCount,
    textureSize,
  } = options
  if (!pipeline || !uniformStore || !uniformBuffer) return false
  if (!currentPositionTexture || currentPositionTexture.destroyed) return false
  if (!positionStorageBuffer || positionStorageBuffer.destroyed) return false
  if (pointCount === 0 || textureSize === 0) return false

  uniformStore.setUniforms({
    syncPositionUniforms: { pointCount, textureSize },
  })
  pipeline.setBindings({
    syncPositionUniforms: uniformBuffer,
    positionsTexture: currentPositionTexture,
    positionsBuf: positionStorageBuffer,
  })
  const pass = device.beginComputePass({ id: 'sync.position-storage' })
  pass.setPipeline(pipeline)
  pass.dispatch(Math.ceil(pointCount / 64), 1, 1)
  pass.end()
  return true
}

export type UpdatePositionComputeOptions = {
  device: Device;
  pipeline: ComputePipeline | undefined;
  uniformStore: UniformStore<UpdatePositionComputeUniforms> | undefined;
  uniformBuffer: Buffer | undefined;
  currentPositionTexture: Texture | undefined;
  previousPositionTexture: Texture | undefined;
  velocityTexture: Texture | undefined;
  pinnedStatusTexture: Texture | undefined;
  positionStorageBuffer: Buffer | undefined;
  friction: number;
  spaceSize: number;
  pointCount: number;
  textureSize: number;
}

export function runUpdatePositionCompute (options: UpdatePositionComputeOptions): boolean {
  const {
    device,
    pipeline,
    uniformStore,
    uniformBuffer,
    currentPositionTexture,
    previousPositionTexture,
    velocityTexture,
    pinnedStatusTexture,
    positionStorageBuffer,
    friction,
    spaceSize,
    pointCount,
    textureSize,
  } = options
  if (!pipeline || !uniformStore || !uniformBuffer) return false
  if (!currentPositionTexture || currentPositionTexture.destroyed) return false
  if (!previousPositionTexture || previousPositionTexture.destroyed) return false
  if (!velocityTexture || velocityTexture.destroyed) return false
  if (!pinnedStatusTexture || pinnedStatusTexture.destroyed) return false
  if (!positionStorageBuffer || positionStorageBuffer.destroyed) return false
  if (pointCount === 0 || textureSize === 0) return false

  uniformStore.setUniforms({
    updatePositionUniforms: { friction, spaceSize, pointCount, textureSize },
  })
  pipeline.setBindings({
    updatePositionUniforms: uniformBuffer,
    previousPositions: previousPositionTexture,
    velocity: velocityTexture,
    pinnedStatusTexture,
    positionsOut: currentPositionTexture,
    positionsBuf: positionStorageBuffer,
  })
  const pass = device.beginComputePass({ id: 'update-position.buffer-first' })
  pass.setPipeline(pipeline)
  pass.dispatch(Math.ceil(pointCount / 64), 1, 1)
  pass.end()
  return true
}

export type DragPointComputeOptions = {
  device: Device;
  pipeline: ComputePipeline | undefined;
  uniformStore: UniformStore<DragPointComputeUniforms> | undefined;
  uniformBuffer: Buffer | undefined;
  currentPositionTexture: Texture | undefined;
  previousPositionTexture: Texture | undefined;
  positionStorageBuffer: Buffer | undefined;
  mousePos: [number, number];
  index: number;
  pointCount: number;
  textureSize: number;
}

export function runDragPointCompute (options: DragPointComputeOptions): boolean {
  const {
    device,
    pipeline,
    uniformStore,
    uniformBuffer,
    currentPositionTexture,
    previousPositionTexture,
    positionStorageBuffer,
    mousePos,
    index,
    pointCount,
    textureSize,
  } = options
  if (!pipeline || !uniformStore || !uniformBuffer) return false
  if (!currentPositionTexture || currentPositionTexture.destroyed) return false
  if (!previousPositionTexture || previousPositionTexture.destroyed) return false
  if (!positionStorageBuffer || positionStorageBuffer.destroyed) return false
  if (pointCount === 0 || textureSize === 0) return false

  uniformStore.setUniforms({
    dragPointUniforms: { mousePos, index, pointCount, textureSize },
  })
  pipeline.setBindings({
    dragPointUniforms: uniformBuffer,
    previousPositions: previousPositionTexture,
    positionsOut: currentPositionTexture,
    positionsBuf: positionStorageBuffer,
  })
  const pass = device.beginComputePass({ id: 'drag-point.buffer-first' })
  pass.setPipeline(pipeline)
  pass.dispatch(Math.ceil(pointCount / 64), 1, 1)
  pass.end()
  return true
}
