import {
  AMBIENT_VOLUME_PARTICLES,
  CLUSTER_CORE_PARTICLES,
  CLUSTER_PARTICLES,
  FIELD_STARS,
  FIELD_X_SPAN,
  FIELD_Z_FAR,
  FIELD_Z_NEAR,
  FILAMENT_PARTICLES,
} from './scene-constants'
import { edgePoint } from './scene-clusters'
import {
  mixColor,
  nearestClusterColor,
  pickWeightedCluster,
  seededUnit,
  terrainHeight,
  writeColor,
} from './scene-helpers'
import { createFilamentParticlePoints, createParticlePoints } from './scene-particle-points'
import type { ClusterSpec, FilamentEdge } from './scene-types'
import type { CosmicSceneHandles } from './types'
import type * as THREE from 'three'

export function pickWeightedEdge (edges: FilamentEdge[], rand: () => number): FilamentEdge {
  const total = edges.reduce((sum, edge) => sum + edge.strength, 0)
  let cursor = rand() * total
  for (const edge of edges) {
    cursor -= edge.strength
    if (cursor <= 0) return edge
  }
  return edges[edges.length - 1]!
}

export function createParticleField (
  clusters: ClusterSpec[],
  uniforms: CosmicSceneHandles['particleUniforms']
): THREE.Points {
  const rand = seededUnit(11_417)
  const count = FIELD_STARS + CLUSTER_PARTICLES
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const twinkle = new Float32Array(count)

  for (let i = 0; i < count; i += 1) {
    const pi = i * 3
    if (i < CLUSTER_PARTICLES) {
      const cluster = pickWeightedCluster(clusters, rand)
      const theta = rand() * Math.PI * 2
      const radius = rand() > 0.70 ? Math.pow(rand(), 4.4) * 0.70 : Math.pow(rand(), 1.75)
      const lane = (rand() - 0.5) * 2
      const x = cluster.x + Math.cos(theta) * cluster.rx * radius + lane * cluster.rx * 0.46
      const z = cluster.z + Math.sin(theta) * cluster.rz * Math.sqrt(radius) + lane * cluster.rz * 0.28
      positions[pi] = x
      positions[pi + 1] = terrainHeight(x, z, clusters) + (rand() - 0.5) * cluster.ry * 0.42
      positions[pi + 2] = z
      const bright = rand()
      const gain = bright > 0.935 ? 4.2 : 1.18 + rand() * 1.42
      writeColor(colors, pi, cluster.hue, gain)
      sizes[i] = bright > 0.935 ? 10.4 + rand() * 16.8 : 1.50 + rand() * 4.80
    } else {
      const x = (rand() - 0.5) * (FIELD_X_SPAN * 1.24)
      const z = FIELD_Z_FAR - 420 + rand() * (FIELD_Z_NEAR - FIELD_Z_FAR + 960)
      positions[pi] = x
      positions[pi + 1] = terrainHeight(x, z, clusters) + (rand() - 0.5) * 185
      positions[pi + 2] = z
      const warm = rand() > 0.20
      writeColor(colors, pi, warm ? [1.0, 0.60, 0.16] : [0.30, 0.70, 1.0], 0.78 + rand() * 1.12)
      sizes[i] = 0.92 + rand() * 2.65
    }
    twinkle[i] = rand()
  }

  return createParticlePoints({ positions, colors, sizes, twinkle }, uniforms)
}

export function createAmbientVolume (
  clusters: ClusterSpec[],
  uniforms: CosmicSceneHandles['particleUniforms']
): THREE.Points {
  const rand = seededUnit(221_503)
  const positions = new Float32Array(AMBIENT_VOLUME_PARTICLES * 3)
  const colors = new Float32Array(AMBIENT_VOLUME_PARTICLES * 3)
  const sizes = new Float32Array(AMBIENT_VOLUME_PARTICLES)
  const twinkle = new Float32Array(AMBIENT_VOLUME_PARTICLES)

  for (let i = 0; i < AMBIENT_VOLUME_PARTICLES; i += 1) {
    const pi = i * 3
    const depth = Math.pow(rand(), 0.62)
    const x = (rand() - 0.5) * (FIELD_X_SPAN * (1.08 + depth * 0.62))
    const z = FIELD_Z_FAR - 2200 + depth * (FIELD_Z_NEAR - FIELD_Z_FAR + 3200)
    const floor = terrainHeight(x, z, clusters)
    const y = floor - 180 + Math.pow(rand(), 0.70) * 2550 + Math.sin(x * 0.0015 + z * 0.0010) * 135
    positions[pi] = x
    positions[pi + 1] = y
    positions[pi + 2] = z
    const warm = rand() > 0.18
    const base = warm ? [1.0, 0.52, 0.13] as [number, number, number] : [0.22, 0.62, 1.0] as [number, number, number]
    const color = mixColor(base, nearestClusterColor(x * 0.35, z * 0.35, clusters), 0.22 + rand() * 0.30)
    writeColor(colors, pi, color, 0.56 + rand() * 0.92)
    sizes[i] = rand() > 0.992 ? 4.8 + rand() * 7.2 : 0.68 + rand() * 1.84
    twinkle[i] = rand()
  }

  return createParticlePoints({ positions, colors, sizes, twinkle }, uniforms)
}

export function createClusterCoreHighlights (
  clusters: ClusterSpec[],
  uniforms: CosmicSceneHandles['particleUniforms']
): THREE.Points {
  const rand = seededUnit(812_309)
  const positions = new Float32Array(CLUSTER_CORE_PARTICLES * 3)
  const colors = new Float32Array(CLUSTER_CORE_PARTICLES * 3)
  const sizes = new Float32Array(CLUSTER_CORE_PARTICLES)
  const twinkle = new Float32Array(CLUSTER_CORE_PARTICLES)
  const massiveClusters = [...clusters].sort((a, b) => b.mass - a.mass).slice(0, 120)

  for (let i = 0; i < CLUSTER_CORE_PARTICLES; i += 1) {
    const pi = i * 3
    const cluster = pickWeightedCluster(massiveClusters, rand)
    const theta = rand() * Math.PI * 2
    const radius = Math.pow(rand(), 2.7)
    const wobble = 0.78 + rand() * 0.34
    const x = cluster.x + Math.cos(theta) * cluster.rx * radius * 0.34 * wobble + (rand() - 0.5) * cluster.rx * 0.10
    const z = cluster.z + Math.sin(theta) * cluster.rz * radius * 0.34 / wobble + (rand() - 0.5) * cluster.rz * 0.10
    positions[pi] = x
    positions[pi + 1] = terrainHeight(x, z, clusters) + (rand() - 0.5) * cluster.ry * 0.24
    positions[pi + 2] = z

    const hot = rand() > 0.36
    const color = hot
      ? mixColor(cluster.hue, [1.0, 0.64, 0.18], 0.38 + rand() * 0.22)
      : mixColor(cluster.hue, [0.34, 0.74, 1.0], 0.16 + rand() * 0.18)
    writeColor(colors, pi, color, 1.15 + rand() * 1.10)
    sizes[i] = rand() > 0.84 ? 7.0 + rand() * 10.5 : 2.4 + rand() * 5.4
    twinkle[i] = rand()
  }

  return createParticlePoints({ positions, colors, sizes, twinkle }, uniforms)
}

export function createFilamentDust (
  clusters: ClusterSpec[],
  edges: FilamentEdge[],
  uniforms: CosmicSceneHandles['filamentUniforms']
): THREE.Points {
  const rand = seededUnit(64_207)
  const positions = new Float32Array(FILAMENT_PARTICLES * 3)
  const colors = new Float32Array(FILAMENT_PARTICLES * 3)
  const sizes = new Float32Array(FILAMENT_PARTICLES)
  const twinkle = new Float32Array(FILAMENT_PARTICLES)

  for (let i = 0; i < FILAMENT_PARTICLES; i += 1) {
    const edge = pickWeightedEdge(edges, rand)
    const a = clusters[edge.a]!
    const b = clusters[edge.b]!
    const t = Math.min(1, Math.max(0, rand() * 1.08 - 0.04))
    const lane = (rand() - 0.5) * (12 + 38 * Math.sin(t * Math.PI))
    const phase = rand() * Math.PI * 2
    const p = edgePoint(a, b, edge, t, lane, phase, clusters)
    const spread = 2 + Math.sin(t * Math.PI) * 9
    const pi = i * 3
    positions[pi] = p[0] + (rand() - 0.5) * spread
    positions[pi + 1] = p[1] + (rand() - 0.5) * spread * 0.52
    positions[pi + 2] = p[2] + (rand() - 0.5) * spread
    writeColor(colors, pi, mixColor(edge.color, [1.0, 0.54, 0.14], 0.30), 0.82 + rand() * 1.24)
    sizes[i] = rand() > 0.988 ? 5.2 + rand() * 6.2 : 1.02 + rand() * 1.95
    twinkle[i] = rand()
  }

  return createFilamentParticlePoints({ positions, colors, sizes, twinkle }, uniforms)
}
