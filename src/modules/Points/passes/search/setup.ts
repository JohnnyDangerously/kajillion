import type { Buffer, Device, UniformStore } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import type { GraphConfigInterface } from '@/graph/config'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Store } from '@/graph/modules/Store'
import type {
  FillSampledPointsUniforms,
  FindHoveredPointUniforms,
  FindPointsInPolygonUniforms,
  FindPointsInRectUniforms,
} from '@/graph/modules/Points/passes/draw/contracts'
import {
  ensureFillSampledPointsSetup,
  ensureFindHoveredPointSetup,
  ensureFindPointsInPolygonSetup,
  ensureFindPointsInRectSetup,
} from './commands'

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

export type PointSearchSetupOptions = {
  device: Device;
  config: GraphConfigInterface;
  store: Store;
  data: GraphData;
  pointStatusTextureSize: number;
  effectivePixelRatio: number;
  polygonPathLength: number;
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
  hoveredPointIndices: Buffer | undefined;
  sampledPointIndices: Buffer | undefined;
  sizeBuffer: Buffer | undefined;
  imageSizesBuffer: Buffer | undefined;
}

export function ensurePointSearchSetup (options: PointSearchSetupOptions): PointSearchSetupState {
  return {
    ...ensureFindPointsInRectSetup(options),
    ...ensureFindPointsInPolygonSetup(options),
    ...ensureFindHoveredPointSetup(options),
    ...ensureFillSampledPointsSetup(options),
  }
}
