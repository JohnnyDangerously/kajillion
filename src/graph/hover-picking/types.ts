export interface HoverChange {
  mouseover: boolean;
  mouseout: boolean;
}

export interface HoverDetectionResult {
  point: HoverChange;
  link: HoverChange;
}

export interface LinkHoverPathCache {
  tValues: Float32Array | undefined;
  tValuesSegments: number;
}

export interface TransformLike {
  x: number;
  y: number;
  k: number;
}
