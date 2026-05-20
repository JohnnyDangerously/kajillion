export type NodeTreatment = 'rim' | 'halo' | 'glass' | 'ink' | 'selected' | 'vip'
export type LabScene = 'pair' | 'cluster' | 'scale'
export type LabPalette = 'bright' | 'dark' | 'neon' | 'pastel'
export type LabBorder = 'black' | 'white' | 'same-bright' | 'same-dark' | 'double' | 'none'
export type LabLighting = 'flat' | 'sphere' | 'glass' | 'halo' | 'specular' | 'depth'
export type LabSharpness = 'sdf' | 'crisp' | 'soft' | 'ink' | 'sparkle'

export type LabState = {
  treatment: NodeTreatment;
  scene: LabScene;
  palette: LabPalette;
  border: LabBorder;
  lighting: LabLighting;
  sharpness: LabSharpness;
  zoom: number;
  panX: number;
  panY: number;
}

export type TreatmentMeta = {
  fill: string;
  edge: string;
  cost: string;
  pass: string;
}

export type LabNode = {
  x: number;
  y: number;
  radius: number;
  color: string;
  label?: string;
  depth?: number;
  selected?: boolean;
}
