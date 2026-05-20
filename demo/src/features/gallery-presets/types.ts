export type GalleryPalette =
  'category' | 'ember' | 'ion' | 'signal' | 'tokyo' | 'subnet' | 'analyst' | 'insight' | 'fintech' | 'influence' | 'talent' | 'cosmic'

export interface GalleryGraphData {
  positions: Float32Array;
  links: Float32Array;
  nodeCount: number;
  edgeCount: number;
}

export type LabelAnchor = { label: string; x: number; y: number }
export type RgbColor = [number, number, number]
