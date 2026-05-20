import type { Buffer, Device, UniformStore } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import type { GraphConfigInterface } from '@/graph/config'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Store } from '@/graph/modules/Store'
import { createFullscreenQuadBuffer } from '@/graph/modules/Points/passes/resources/lifecycle'
import type {
  DrawHighlightedUniforms,
  PointDrawUniforms,
} from '@/graph/modules/Points/passes/draw/contracts'
import {
  createCulledPointDrawCommand,
  createHighlightedPointDrawCommand,
  createPointDrawCommand,
} from '@/graph/modules/Points/passes/draw/model-options'
import {
  createDrawHighlightedUniformStore,
  createPointDrawUniformStore,
} from '@/graph/modules/Points/passes/draw/uniform-stores'

export type PointDrawSetupState = {
  command: Model;
  uniformStore: UniformStore<PointDrawUniforms>;
  quadVertexBuffer: Buffer | undefined;
}

export type HighlightedPointDrawSetupState = {
  command: Model;
  uniformStore: UniformStore<DrawHighlightedUniforms>;
  vertexCoordBuffer: Buffer;
}

export type CulledPointDrawSetupState = {
  command: Model;
  quadVertexBuffer: Buffer;
}

export type PointDrawSetupOptions = {
  device: Device;
  command: Model | undefined;
  uniformStore: UniformStore<PointDrawUniforms> | undefined;
  quadVertexBuffer: Buffer | undefined;
  pointIndices: Buffer | undefined;
  sizeBuffer: Buffer | undefined;
  colorBuffer: Buffer | undefined;
  shapeBuffer: Buffer | undefined;
  imageIndicesBuffer: Buffer | undefined;
  imageSizesBuffer: Buffer | undefined;
  config: GraphConfigInterface;
  store: Store;
  data: GraphData;
  imageCount: number;
  imageAtlasCoordsTextureSize: number | undefined;
  effectivePixelRatio: number;
  pointLodStrength: number;
  sampleCount: number;
}

export type HighlightedPointDrawSetupOptions = {
  device: Device;
  command: Model | undefined;
  uniformStore: UniformStore<DrawHighlightedUniforms> | undefined;
  vertexCoordBuffer: Buffer | undefined;
  config: GraphConfigInterface;
  store: Store;
  sampleCount: number;
}

export type CulledPointDrawSetupOptions = {
  device: Device;
  command: Model | undefined;
  uniformStore: UniformStore<PointDrawUniforms>;
  quadVertexBuffer: Buffer | undefined;
  sampleCount: number;
}

export function ensurePointDrawSetup (
  options: PointDrawSetupOptions
): PointDrawSetupState {
  const isWebGPU = options.device.info?.type === 'webgpu'
  const uniformStore = options.uniformStore ?? createPointDrawUniformStore(options)
  const quadVertexBuffer = isWebGPU
    ? (options.quadVertexBuffer ?? createFullscreenQuadBuffer(options.device))
    : options.quadVertexBuffer
  const command = options.command ?? createPointDrawCommand({
    device: options.device,
    uniformStore,
    quadVertexBuffer,
    pointIndices: options.pointIndices,
    sizeBuffer: options.sizeBuffer,
    colorBuffer: options.colorBuffer,
    shapeBuffer: options.shapeBuffer,
    imageIndicesBuffer: options.imageIndicesBuffer,
    imageSizesBuffer: options.imageSizesBuffer,
    data: options.data,
    sampleCount: options.sampleCount,
    isWebGPU,
  })

  return { command, uniformStore, quadVertexBuffer }
}

export function ensureHighlightedPointDrawSetup (
  options: HighlightedPointDrawSetupOptions
): HighlightedPointDrawSetupState {
  const vertexCoordBuffer = options.vertexCoordBuffer ?? createFullscreenQuadBuffer(options.device)
  const uniformStore = options.uniformStore ?? createDrawHighlightedUniformStore(options)
  const command = options.command ?? createHighlightedPointDrawCommand({
    device: options.device,
    uniformStore,
    vertexCoordBuffer,
    sampleCount: options.sampleCount,
  })

  return { command, uniformStore, vertexCoordBuffer }
}

export function ensureCulledPointDrawCommand (
  options: CulledPointDrawSetupOptions
): CulledPointDrawSetupState {
  const quadVertexBuffer = options.quadVertexBuffer ?? createFullscreenQuadBuffer(options.device)
  const command = options.command ?? createCulledPointDrawCommand({
    device: options.device,
    uniformStore: options.uniformStore,
    quadVertexBuffer,
    sampleCount: options.sampleCount,
  })

  return { command, quadVertexBuffer }
}
