import type { Mat4Array } from '@/graph/modules/Store'

export type PointDrawVertexUniforms = {
  ratio: number;
  transformationMatrix: Mat4Array;
  pointsTextureSize: number;
  sizeScale: number;
  spaceSize: number;
  screenSize: [number, number];
  greyoutColor: [number, number, number, number];
  backgroundColor: [number, number, number, number];
  scalePointsOnZoom: number;
  maxPointSize: number;
  isDarkenGreyout: number;
  skipHighlighted: number;
  skipGreyed: number;
  hasImages: number;
  imageCount: number;
  imageAtlasCoordsTextureSize: number;
  pointMinPixelSize: number;
  pointLodStrength: number;
  pointLodZoomRange: [number, number];
  pointLodMinSampleRate: number;
  pointLodSizeCompensation: number;
  pointLodOpacityCompensation: number;
  renderPositionMix: number;
  pointDepthCueStrength: number;
  pointDepthCueSize: number;
  pointDepthCueBrightness: number;
  pointDepthCueOpacity: number;
  pointDepthCueMoat: number;
  pointDepthCueHighlight: number;
  pointDepthCueShadow: number;
  pointDepthCueSaturation: number;
}

export type PointDrawFragmentUniforms = {
  greyoutOpacity: number;
  pointOpacity: number;
  isDarkenGreyout: number;
  backgroundColor: [number, number, number, number];
  outlineColor: [number, number, number, number];
  outlineWidth: number;
  hasNonCircleShapes: number;
  hasOutlinedPoints: number;
  hasImagedPoints: number;
}

export type SyncPositionUniforms = {
  syncPositionUniforms: { pointCount: number; textureSize: number };
}

export type UpdatePositionComputeUniforms = {
  updatePositionUniforms: {
    friction: number;
    spaceSize: number;
    pointCount: number;
    textureSize: number;
  };
}

export type DragPointComputeUniforms = {
  dragPointUniforms: {
    mousePos: [number, number];
    index: number;
    pointCount: number;
    textureSize: number;
  };
}

export type UpdatePositionUniforms = {
  updatePositionUniforms: {
    friction: number;
    spaceSize: number;
  };
}

export type DragPointUniforms = {
  dragPointUniforms: {
    mousePos: [number, number];
    index: number;
  };
}

export type PointDrawUniforms = {
  drawVertexUniforms: PointDrawVertexUniforms;
  drawFragmentUniforms: PointDrawFragmentUniforms;
}

export type FindPointsInRectUniforms = {
  findPointsInRectUniforms: {
    spaceSize: number;
    screenSize: [number, number];
    sizeScale: number;
    transformationMatrix: Mat4Array;
    ratio: number;
    rect0: [number, number];
    rect1: [number, number];
    scalePointsOnZoom: number;
    maxPointSize: number;
  };
}

export type FindPointsInPolygonUniforms = {
  findPointsInPolygonUniforms: {
    spaceSize: number;
    screenSize: [number, number];
    transformationMatrix: Mat4Array;
    polygonPathLength: number;
  };
}

export type FindHoveredPointUniforms = {
  findHoveredPointUniforms: {
    ratio: number;
    sizeScale: number;
    pointsTextureSize: number;
    transformationMatrix: Mat4Array;
    spaceSize: number;
    screenSize: [number, number];
    scalePointsOnZoom: number;
    mousePosition: [number, number];
    maxPointSize: number;
    skipHighlighted: number;
    skipGreyed: number;
  };
}

export type FillSampledPointsUniforms = {
  fillSampledPointsUniforms: {
    pointsTextureSize: number;
    transformationMatrix: Mat4Array;
    spaceSize: number;
    screenSize: [number, number];
  };
}

export type DrawHighlightedUniforms = {
  drawHighlightedUniforms: {
    color: [number, number, number, number];
    width: number;
    pointIndex: number;
    size: number;
    sizeScale: number;
    pointsTextureSize: number;
    transformationMatrix: Mat4Array;
    spaceSize: number;
    screenSize: [number, number];
    scalePointsOnZoom: number;
    maxPointSize: number;
    universalPointOpacity: number;
    greyoutOpacity: number;
    isDarkenGreyout: number;
    backgroundColor: [number, number, number, number];
    greyoutColor: [number, number, number, number];
  };
}

export type TrackPointsUniforms = {
  trackPointsUniforms: {
    pointsTextureSize: number;
  };
}
