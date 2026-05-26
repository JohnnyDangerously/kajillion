import { DEMO_SPACE_SIZE } from './demo-space'
import { ATLAS_ANCHORS, ATLAS_ISLANDS, type AtlasAnchor } from './work-graph-atlas-shape'

export function atlasHash (value: number, seed: number): number {
  let x = (Math.imul(value + 1, 2246822519) ^ Math.imul(seed + 101, 3266489917)) >>> 0
  x = Math.imul(x ^ (x >>> 15), 668265263) >>> 0
  return ((x ^ (x >>> 16)) >>> 0) / 0x1_0000_0000
}

export function clampAtlasField (value: number): number {
  return Math.max(90, Math.min(DEMO_SPACE_SIZE - 90, value))
}

function atlasDisplayPoint (x: number, y: number): { x: number; y: number } {
  const center = DEMO_SPACE_SIZE / 2
  return {
    x: clampAtlasField(center + (x - center) * 0.78),
    y: clampAtlasField(center + (y - center) * 0.88),
  }
}

export function atlasGroupLayout (group: number): AtlasAnchor {
  return ATLAS_ANCHORS[group % ATLAS_ANCHORS.length] ?? ATLAS_ANCHORS[0]!
}

function atlasIslandCenter (group: number, cluster: number, seed: number): { x: number; y: number } {
  const key = group * 389 + cluster * 31
  const island = ATLAS_ISLANDS[Math.floor(atlasHash(key, seed) * ATLAS_ISLANDS.length)]!
  const angle = atlasHash(key + 17, seed) * Math.PI * 2
  const radius = Math.sqrt(atlasHash(key + 23, seed))
  const tailChance = atlasHash(key + 29, seed)
  const tail = tailChance > 0.78 ? Math.pow(atlasHash(key + 37, seed), 0.85) * island.tail : 0
  const wave = Math.sin(cluster * 1.7 + group * 0.9) * 0.018
  const x = (island.x + Math.cos(angle) * island.rx * radius + Math.cos(island.angle) * tail) * DEMO_SPACE_SIZE
  const y = (island.y + Math.sin(angle) * island.ry * radius + Math.sin(island.angle) * tail + wave) * DEMO_SPACE_SIZE
  return atlasDisplayPoint(x, y)
}

export function chooseAtlasCenter (group: number, cluster: number, seed: number): { x: number; y: number } {
  const key = group * 997 + cluster * 53
  if (atlasHash(key + 91, seed) > 0.42) return atlasIslandCenter(group, cluster, seed)

  const anchor = atlasGroupLayout(group)
  const angle = anchor.angle + (atlasHash(key + 11, seed) - 0.5) * 2.25
  const radius = Math.pow(atlasHash(key + 17, seed), 0.58) * anchor.radius * 0.34
  const curl = Math.sin(cluster * 0.83 + group * 1.37) * anchor.radius * 0.070
  const tail = Math.pow(atlasHash(key + 23, seed), 2.6) * anchor.radius * 0.20
  const x = anchor.x * DEMO_SPACE_SIZE + Math.cos(angle) * (radius + tail)
  const y = anchor.y * DEMO_SPACE_SIZE + Math.sin(angle) * radius * 0.74 + Math.cos(angle) * curl
  return atlasDisplayPoint(x, y)
}
