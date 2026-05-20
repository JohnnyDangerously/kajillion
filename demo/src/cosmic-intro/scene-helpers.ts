import type { ClusterSpec, CosmicColor } from './scene-types'

export function seededUnit (seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
}

export function writeColor (target: Float32Array, index: number, color: CosmicColor, gain = 1): void {
  target[index] = Math.min(1, color[0] * gain)
  target[index + 1] = Math.min(1, color[1] * gain)
  target[index + 2] = Math.min(1, color[2] * gain)
}

export function mixColor (
  a: CosmicColor,
  b: CosmicColor,
  t: number
): CosmicColor {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]
}

export function clusterColor (i: number, rand: () => number): CosmicColor {
  const palette: CosmicColor[] = [
    [1.00, 0.48, 0.10],
    [1.00, 0.76, 0.34],
    [1.00, 0.62, 0.18],
    [1.00, 0.86, 0.48],
    [0.94, 0.38, 0.12],
    [1.00, 0.70, 0.24],
    [1.00, 0.56, 0.12],
    [0.98, 0.84, 0.52],
    [0.36, 0.70, 1.00],
    [0.18, 0.92, 0.92],
    [0.70, 0.44, 1.00],
    [0.98, 0.26, 0.62],
  ]
  const base = palette[i % palette.length]!
  const warm = palette[(i + 1 + Math.floor(rand() * 2)) % palette.length]!
  return mixColor(base, warm, rand() * 0.24)
}

export function baseTerrainHeight (x: number, z: number): number {
  return -118 +
    Math.sin(x * 0.0017 + z * 0.00072) * 72 +
    Math.cos(x * 0.00105 - z * 0.00125) * 58 +
    Math.sin((x + z) * 0.00115) * 42 +
    Math.cos((x - z) * 0.00062) * 64
}

export function terrainHeight (x: number, z: number, clusters: ClusterSpec[]): number {
  let h = baseTerrainHeight(x, z)
  for (const cluster of clusters) {
    const dx = x - cluster.x
    const dz = z - cluster.z
    const range = 420 + cluster.mass * 120
    h += Math.exp(-(dx * dx + dz * dz) / (range * range)) * (18 + cluster.mass * 13)
  }
  return h
}

export function nearestClusterColor (x: number, z: number, clusters: ClusterSpec[]): CosmicColor {
  let best = clusters[0]!
  let bestDistance = Infinity
  for (const cluster of clusters) {
    const dx = x - cluster.x
    const dz = z - cluster.z
    const d = dx * dx + dz * dz
    if (d < bestDistance) {
      bestDistance = d
      best = cluster
    }
  }
  return best.hue
}

export function pickWeightedCluster (clusters: ClusterSpec[], rand: () => number): ClusterSpec {
  const total = clusters.reduce((sum, cluster) => sum + cluster.mass, 0)
  let cursor = rand() * total
  for (const cluster of clusters) {
    cursor -= cluster.mass
    if (cursor <= 0) return cluster
  }
  return clusters[clusters.length - 1]!
}
