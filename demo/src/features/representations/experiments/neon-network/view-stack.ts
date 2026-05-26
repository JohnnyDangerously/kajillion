import type { ColorMode } from './color-modes'
import type { PersonalNetwork } from './personal-network'

export interface ExplodeLevel {
  kind: 'explode';
  key: string;
  value: string;
  members: number[];
  facet: ColorMode;
  secondaryFacet: ColorMode;
  subClusters: Map<string, {
    value: string;
    members: number[];
    centroid: { x: number; y: number } | null;
  }>;
  byNodeSecondary: Map<number, string>;
}

export interface PortraitLevel {
  kind: 'portrait';
  value: string;
  members: number[];
  edges: Float32Array;
}

export interface PersonalLevel {
  kind: 'personal';
  focalIdx: number;
  focalName: string;
  pnet: PersonalNetwork;
}

export type ViewLevel = ExplodeLevel | PortraitLevel | PersonalLevel
