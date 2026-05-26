import { DEMO_SPACE_SIZE } from '../../../demo-lifecycle/demo-space'
import { ATLAS_GROUP_COUNT, atlasHash } from './metrics'

const ISLANDS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0.30, 0.28, 1.55, 1.02],
  [0.42, 0.26, 1.20, 0.88],
  [0.55, 0.30, 1.48, 1.00],
  [0.69, 0.32, 1.34, 0.94],
  [0.25, 0.45, 1.36, 1.02],
  [0.40, 0.48, 1.58, 1.02],
  [0.56, 0.49, 1.42, 0.96],
  [0.74, 0.52, 1.62, 1.04],
  [0.30, 0.66, 1.42, 1.02],
  [0.47, 0.68, 1.54, 1.00],
  [0.65, 0.70, 1.36, 0.94],
  [0.79, 0.72, 1.08, 0.78],
  [0.17, 0.58, 1.02, 0.78],
]

export type AtlasCenter = { x: number; y: number; cluster: number }

export function atlasGroupCenter (group: number): { x: number; y: number; sx: number; sy: number } {
  const spec = ISLANDS[group % ATLAS_GROUP_COUNT]!
  return {
    x: spec[0] * DEMO_SPACE_SIZE,
    y: spec[1] * DEMO_SPACE_SIZE,
    sx: spec[2] * 900,
    sy: spec[3] * 760,
  }
}

export function atlasClusterCenter (group: number, cluster: number, seed: number): AtlasCenter {
  const base = atlasGroupCenter(group)
  const arm = cluster * 2.399963229728653 + atlasHash(group * 977 + cluster, seed) * 0.34
  const r = Math.sqrt(cluster + 0.8) * 88 + atlasHash(group * 41 + cluster * 7, seed) * 72
  const curl = Math.sin(cluster * 0.37 + group * 1.7) * 230
  return {
    x: clamp(base.x + Math.cos(arm) * r * base.sx / 900 + Math.cos(arm + Math.PI / 2) * curl),
    y: clamp(base.y + Math.sin(arm) * r * base.sy / 760 + Math.sin(arm + Math.PI / 2) * curl * 0.64),
    cluster,
  }
}

function clamp (v: number): number {
  return Math.max(220, Math.min(DEMO_SPACE_SIZE - 220, v))
}
