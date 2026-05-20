import {
  CLUSTER_COUNT,
  EDGE_NEIGHBORS,
  FIELD_X_SPAN,
  FIELD_Z_FAR,
  FIELD_Z_NEAR,
} from './scene-constants'
import { baseTerrainHeight, clusterColor, mixColor, seededUnit, terrainHeight } from './scene-helpers'
import type { ClusterSpec, FilamentEdge } from './scene-types'

export function createClusters (): ClusterSpec[] {
  const rand = seededUnit(70_123)
  const clusters: ClusterSpec[] = []
  const laneCount = 15
  const laneOffsets = Array.from({ length: laneCount }, (_, i) => {
    return (i / (laneCount - 1) - 0.5) * FIELD_X_SPAN * 0.94 + (rand() - 0.5) * 560
  })

  const wrapX = (x: number): number => {
    const half = FIELD_X_SPAN * 0.64
    let wrapped = x
    while (wrapped < -half) wrapped += half * 2
    while (wrapped > half) wrapped -= half * 2
    return wrapped
  }

  while (clusters.length < CLUSTER_COUNT) {
    const t = Math.pow(rand(), 0.92)
    const lane = Math.floor(rand() * laneCount)
    const z = FIELD_Z_FAR + t * (FIELD_Z_NEAR - FIELD_Z_FAR) + (rand() - 0.5) * 760
    const riverX =
      laneOffsets[lane]! +
      Math.sin(t * Math.PI * (2.4 + lane * 0.08) + lane * 1.73) * 650 +
      Math.sin(t * Math.PI * 5.8 + lane * 0.61) * 285
    const scattered = rand() > 0.74
    const x = scattered
      ? (rand() - 0.5) * FIELD_X_SPAN * 1.18
      : wrapX(riverX + (rand() - 0.5) * (520 + rand() * 680))
    const y = baseTerrainHeight(x, z) + (rand() - 0.5) * 58
    const mass = 0.96 + Math.pow(rand(), 0.38) * 2.45
    clusters.push({
      x,
      y,
      z,
      rx: 86 + rand() * 142 + mass * 38,
      ry: 24 + rand() * 52 + mass * 12,
      rz: 96 + rand() * 156 + mass * 42,
      hue: clusterColor(clusters.length, rand),
      mass,
    })
  }

  clusters.push({
    x: 70,
    y: baseTerrainHeight(70, -48) + 46,
    z: -48,
    rx: 180,
    ry: 62,
    rz: 190,
    hue: [1.0, 0.78, 0.36],
    mass: 2.7,
  })
  return clusters
}

function distanceSq (a: ClusterSpec, b: ClusterSpec): number {
  const dx = a.x - b.x
  const dy = (a.y - b.y) * 2.3
  const dz = a.z - b.z
  return dx * dx + dy * dy + dz * dz
}

export function createEdges (clusters: ClusterSpec[]): FilamentEdge[] {
  const rand = seededUnit(91_771)
  const edges: FilamentEdge[] = []
  const seen = new Set<string>()

  const addEdge = (aIndex: number, bIndex: number, strength: number): void => {
    if (aIndex === bIndex) return
    const a = Math.min(aIndex, bIndex)
    const b = Math.max(aIndex, bIndex)
    const key = `${a}:${b}`
    if (seen.has(key)) return
    seen.add(key)
    const ca = clusters[a]!
    const cb = clusters[b]!
    edges.push({
      a,
      b,
      strength,
      color: mixColor(ca.hue, cb.hue, 0.42 + rand() * 0.18),
      bowX: (rand() - 0.5) * 430,
      bowY: (rand() - 0.5) * 145,
      bowZ: (rand() - 0.5) * 430,
    })
  }

  for (let i = 0; i < clusters.length; i += 1) {
    const distances = clusters
      .map((cluster, index) => ({ index, d: index === i ? Infinity : distanceSq(clusters[i]!, cluster) }))
      .sort((a, b) => a.d - b.d)
    for (let n = 0; n < EDGE_NEIGHBORS; n += 1) {
      const neighbor = distances[n]
      if (!neighbor) continue
      addEdge(i, neighbor.index, 1.0 - n * 0.13)
    }
  }

  for (let i = 0; i < clusters.length; i += 1) {
    if (rand() < 0.82) addEdge(i, Math.floor(rand() * clusters.length), 0.38 + rand() * 0.24)
  }
  return edges
}

export function edgePoint (
  a: ClusterSpec,
  b: ClusterSpec,
  edge: FilamentEdge,
  t: number,
  lane: number,
  phase: number,
  clusters: ClusterSpec[]
): [number, number, number] {
  const wave = Math.sin(t * Math.PI)
  const curl = Math.sin(t * Math.PI * 5.5 + phase)
  const cross = Math.cos(t * Math.PI * 4.0 + phase)
  const x = a.x + (b.x - a.x) * t + edge.bowX * wave + lane * 22 + curl * 28
  const z = a.z + (b.z - a.z) * t + edge.bowZ * wave - lane * 18 + curl * 24
  return [
    x,
    terrainHeight(x, z, clusters) + edge.bowY * wave * 0.26 + cross * 15,
    z,
  ]
}
