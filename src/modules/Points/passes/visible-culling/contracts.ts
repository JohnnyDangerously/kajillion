import type { Mat4Array } from '@/graph/modules/Store'
import type { Buffer } from '@luma.gl/core'

export type CullVisiblePointsUniforms = {
  cullUniforms: {
    ratio: number;
    transformationMatrix: Mat4Array;
    pointCount: number;
    spaceSize: number;
    screenSize: [number, number];
    sizeScale: number;
    scalePointsOnZoom: number;
    maxPointSize: number;
    pointMinPixelSize: number;
    pointLodStrength: number;
    pointLodZoomRange: [number, number];
    pointLodMinSampleRate: number;
    pointLodSizeCompensation: number;
    renderPositionMix: number;
    activeMaskEnabled: number;
    tileBudget: number;
    tileBudgetSize: number;
    tileBudgetColumns: number;
    tileBudgetRows: number;
    tileBudgetSlots: number;
  };
}

export type VisiblePointTileBudgetLayout = {
  budget: number;
  tileSize: number;
  tileColumns: number;
  tileRows: number;
  slots: number;
  capacity: number;
}

export type VisiblePointBufferLayout = {
  pointCapacity: number;
  groupCount: number;
  blockCount: number;
}

export type VisiblePointBufferSet = {
  visiblePointIndexBuffer: Buffer | undefined;
  visiblePointIndirectBuffer: Buffer | undefined;
  visiblePointGroupOffsetBuffer: Buffer | undefined;
  visiblePointMaskBuffer: Buffer | undefined;
  visiblePointBlockSumBuffer: Buffer | undefined;
  visiblePointBlockOffsetBuffer: Buffer | undefined;
}

export type VisiblePointBufferLifecycleState = VisiblePointBufferSet & {
  visiblePointCapacity: number;
  visiblePointGroupCapacity: number;
  visiblePointBlockCapacity: number;
}

export type VisiblePointTileBudgetBufferState = {
  visiblePointTileBudgetBuffer: Buffer | undefined;
  visiblePointTileBudgetCapacity: number;
}
