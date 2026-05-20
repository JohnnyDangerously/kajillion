import type { Mat4Array } from '@/graph/modules/Store'

export type DensityImpostorUniforms = {
  densityUniforms: {
    ratio: number;
    transformationMatrix: Mat4Array;
    spaceSize: number;
    screenSize: [number, number];
    sizeScale: number;
    pointOpacity: number;
    maxPointSize: number;
    densityPointSizeScale: number;
  };
}

export type DensityCompositeUniforms = {
  compositeUniforms: {
    strength: number;
    opacity: number;
  };
}

export type TileImpostorUniforms = {
  tileUniforms: {
    ratio: number;
    transformationMatrix: Mat4Array;
    spaceSize: number;
    screenSize: [number, number];
    tileSize: number;
    pointCount: number;
    tileColumns: number;
    tileRows: number;
    colorScale: number;
    positionScale: number;
    buildSampleRate: number;
    buildSampleWeight: number;
  };
}

export type TileRenderUniforms = {
  tileRenderUniforms: {
    screenSize: [number, number];
    ratio: number;
    tileColumns: number;
    tileRows: number;
    tileSize: number;
    opacity: number;
    strength: number;
    microSplats: number;
    sparseTileThreshold: number;
    massRadiusScale: number;
    massThreshold: number;
    massMaxAlpha: number;
    massColorBoost: number;
    massExtrusion: number;
  };
}

export type HybridAnchorUniforms = {
  hybridAnchorUniforms: {
    ratio: number;
    transformationMatrix: Mat4Array;
    spaceSize: number;
    screenSize: [number, number];
    tileSize: number;
    tileColumns: number;
    tileRows: number;
    pointSizeScale: number;
    denseSampleRate: number;
    denseOpacity: number;
    sparseOpacity: number;
    sparseTileThreshold: number;
    maxPointSize: number;
  };
}

export type HybridAnchorBuildUniforms = {
  hybridAnchorBuildUniforms: {
    ratio: number;
    transformationMatrix: Mat4Array;
    spaceSize: number;
    screenSize: [number, number];
    tileSize: number;
    pointCount: number;
    tileColumns: number;
    tileRows: number;
    anchorsPerTile: number;
    denseSampleRate: number;
    sparseTileThreshold: number;
  };
}

export type CompactedAnchorUniforms = {
  compactedAnchorUniforms: {
    screenSize: [number, number];
    ratio: number;
    pointSizeScale: number;
    denseOpacity: number;
    sparseOpacity: number;
    maxPointSize: number;
  };
}
