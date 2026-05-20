import type { Buffer, Device, Framebuffer, Texture, UniformStore } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import type { GraphConfigInterface } from '@/graph/config/schema'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Store } from '@/graph/modules/Store'
import type {
  FillSampledPointsUniforms,
  FindHoveredPointUniforms,
  FindPointsInPolygonUniforms,
  FindPointsInRectUniforms,
} from '@/graph/modules/Points/passes/draw/contracts'

export type PointSearchSetupState = {
  findPointsInRectCommand: Model | undefined;
  findPointsInRectUniformStore: UniformStore<FindPointsInRectUniforms> | undefined;
  findPointsInRectVertexCoordBuffer: Buffer | undefined;
  findPointsInPolygonCommand: Model | undefined;
  findPointsInPolygonUniformStore: UniformStore<FindPointsInPolygonUniforms> | undefined;
  findPointsInPolygonVertexCoordBuffer: Buffer | undefined;
  findHoveredPointCommand: Model | undefined;
  findHoveredPointUniformStore: UniformStore<FindHoveredPointUniforms> | undefined;
  fillSampledPointsFboCommand: Model | undefined;
  fillSampledPointsUniformStore: UniformStore<FillSampledPointsUniforms> | undefined;
}

export type PointSearchSetupOptions = PointSearchSetupState & {
  device: Device;
  config: GraphConfigInterface;
  store: Store;
  data: GraphData;
  pointStatusTextureSize: number;
  effectivePixelRatio: number;
  polygonPathLength: number;
  hoveredPointIndices: Buffer | undefined;
  sampledPointIndices: Buffer | undefined;
  sizeBuffer: Buffer | undefined;
  imageSizesBuffer: Buffer | undefined;
}

export type FindPointsInRectOptions = {
  device: Device;
  command: Model | undefined;
  uniformStore: UniformStore<FindPointsInRectUniforms> | undefined;
  searchFbo: Framebuffer | undefined;
  currentPositionTexture: Texture | undefined;
  sizeTexture: Texture | undefined;
  config: GraphConfigInterface;
  store: Store;
  effectivePixelRatio: number;
}

export type FindPointsInPolygonOptions = {
  device: Device;
  command: Model | undefined;
  uniformStore: UniformStore<FindPointsInPolygonUniforms> | undefined;
  searchFbo: Framebuffer | undefined;
  currentPositionTexture: Texture | undefined;
  polygonPathTexture: Texture | undefined;
  polygonPathLength: number;
  store: Store;
}

export type FindHoveredPointOptions = {
  device: Device;
  command: Model | undefined;
  uniformStore: UniformStore<FindHoveredPointUniforms> | undefined;
  hoveredFbo: Framebuffer | undefined;
  currentPositionTexture: Texture | undefined;
  pointStatusTexture: Texture | undefined;
  hoveredPointIndices: Buffer | undefined;
  sizeBuffer: Buffer | undefined;
  imageSizesBuffer: Buffer | undefined;
  config: GraphConfigInterface;
  store: Store;
  pointCount: number;
  effectivePixelRatio: number;
}

export type SampledPointFillOptions = {
  device: Device;
  command: Model | undefined;
  uniformStore: UniformStore<FillSampledPointsUniforms> | undefined;
  sampledPointsFbo: Framebuffer | undefined;
  currentPositionTexture: Texture | undefined;
  store: Store;
  pointCount: number;
}
