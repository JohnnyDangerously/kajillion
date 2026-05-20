import type { Buffer, Device, Framebuffer, Texture, UniformStore } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import type { GraphConfigInterface } from '@/graph/config'
import type { Store } from '@/graph/modules/Store'
import type {
  FillSampledPointsUniforms,
  FindHoveredPointUniforms,
  FindPointsInPolygonUniforms,
  FindPointsInRectUniforms,
} from '@/graph/modules/Points/passes/draw/contracts'

export { updatePolygonPathTexture } from './polygon-path-texture'
export type { PolygonPathTextureState } from './polygon-path-texture'
export { readSampledPointPositionsMap, readSampledPoints } from './sampled-readback'

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

export {
  fillSampledPointsFramebuffer,
  runFindHoveredPoint,
  runFindPointsInPolygon,
  runFindPointsInRect,
} from './render-runners'
