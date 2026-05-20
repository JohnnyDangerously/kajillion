import type {
  LabPalette,
  LabState,
  NodeTreatment,
  TreatmentMeta,
} from './types'

export const DEFAULT_LAB_STATE: LabState = {
  treatment: 'rim',
  scene: 'pair',
  palette: 'bright',
  border: 'black',
  lighting: 'sphere',
  sharpness: 'sdf',
  zoom: 100,
  panX: 0,
  panY: 0,
}

export const TREATMENT_PRESETS: Record<NodeTreatment, Partial<LabState> & TreatmentMeta> = {
  rim: {
    palette: 'bright',
    border: 'black',
    lighting: 'sphere',
    sharpness: 'sdf',
    fill: 'bright sphere',
    edge: 'dark moat',
    cost: 'low',
    pass: 'single node shader',
  },
  halo: {
    palette: 'neon',
    border: 'same-bright',
    lighting: 'halo',
    sharpness: 'soft',
    fill: 'core + glow',
    edge: 'luminous rim',
    cost: 'medium',
    pass: 'bloom candidate',
  },
  glass: {
    palette: 'bright',
    border: 'white',
    lighting: 'glass',
    sharpness: 'sdf',
    fill: 'translucent lens',
    edge: 'white inner rim',
    cost: 'high',
    pass: 'multi-pass later',
  },
  ink: {
    palette: 'bright',
    border: 'black',
    lighting: 'flat',
    sharpness: 'ink',
    fill: 'flat fill',
    edge: 'heavy black',
    cost: 'low',
    pass: 'accessibility baseline',
  },
  selected: {
    palette: 'bright',
    border: 'same-bright',
    lighting: 'specular',
    sharpness: 'sdf',
    fill: 'active surface',
    edge: 'focus rings',
    cost: 'medium',
    pass: 'interaction state',
  },
  vip: {
    palette: 'neon',
    border: 'double',
    lighting: 'depth',
    sharpness: 'sparkle',
    fill: 'hero signal',
    edge: 'double rim',
    cost: 'medium',
    pass: 'premium node',
  },
}

export const PALETTES: Record<LabPalette, string[]> = {
  bright: ['#3b82f6', '#14b8a6', '#f97316', '#ec4899', '#8b5cf6', '#84cc16'],
  dark: ['#1d4ed8', '#0f766e', '#9a3412', '#be185d', '#6d28d9', '#4d7c0f'],
  neon: ['#00d4ff', '#00ff9d', '#ffb000', '#ff2ea6', '#7c3cff', '#d7ff35'],
  pastel: ['#93c5fd', '#7dd3c7', '#fdba74', '#f9a8d4', '#c4b5fd', '#bef264'],
}
