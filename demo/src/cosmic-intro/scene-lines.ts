import * as THREE from 'three'
import {
  FIELD_X_SPAN,
  FIELD_Z_FAR,
  FIELD_Z_NEAR,
  FILAMENT_STEPS,
  LINE_FRAGMENT_SHADER,
  LINE_VERTEX_SHADER,
} from './scene-constants'
import { edgePoint } from './scene-clusters'
import { nearestClusterColor, seededUnit, terrainHeight, writeColor } from './scene-helpers'
import type { ClusterSpec, FilamentEdge } from './scene-types'
import type { CosmicSceneHandles } from './types'

function createLineMaterial (
  uniforms: CosmicSceneHandles['filamentUniforms']
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: LINE_VERTEX_SHADER,
    fragmentShader: LINE_FRAGMENT_SHADER,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
}

export function createFilamentLines (
  clusters: ClusterSpec[],
  edges: FilamentEdge[],
  uniforms: CosmicSceneHandles['filamentUniforms']
): THREE.LineSegments {
  const rand = seededUnit(54_031)
  const strandsPerEdge = 4
  const segmentCount = edges.length * strandsPerEdge * (FILAMENT_STEPS - 1)
  const positions = new Float32Array(segmentCount * 2 * 3)
  const colors = new Float32Array(segmentCount * 2 * 3)
  let cursor = 0

  for (const edge of edges) {
    const a = clusters[edge.a]!
    const b = clusters[edge.b]!
    for (let strand = 0; strand < strandsPerEdge; strand += 1) {
      const lane = (strand - 1.5) * (11 + rand() * 24)
      const phase = rand() * Math.PI * 2
      let prev = edgePoint(a, b, edge, 0, lane, phase, clusters)
      for (let step = 1; step < FILAMENT_STEPS; step += 1) {
        const t = step / (FILAMENT_STEPS - 1)
        const next = edgePoint(a, b, edge, t, lane, phase, clusters)
        positions[cursor] = prev[0]
        positions[cursor + 1] = prev[1]
        positions[cursor + 2] = prev[2]
        positions[cursor + 3] = next[0]
        positions[cursor + 4] = next[1]
        positions[cursor + 5] = next[2]
        writeColor(colors, cursor, edge.color, 0.52 + edge.strength * 0.34)
        writeColor(colors, cursor + 3, edge.color, 0.52 + edge.strength * 0.34)
        cursor += 6
        prev = next
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeBoundingSphere()
  return new THREE.LineSegments(geometry, createLineMaterial(uniforms))
}

export function createTopologySurface (
  clusters: ClusterSpec[],
  uniforms: CosmicSceneHandles['filamentUniforms']
): THREE.LineSegments {
  const rand = seededUnit(733_241)
  const xMin = FIELD_X_SPAN * -0.86
  const xMax = FIELD_X_SPAN * 0.86
  const zMin = FIELD_Z_FAR - 2500
  const zMax = FIELD_Z_NEAR + 980
  const curveCount = 1700
  const steps = 58
  const segmentCount = curveCount * (steps - 1)
  const positions = new Float32Array(segmentCount * 2 * 3)
  const colors = new Float32Array(segmentCount * 2 * 3)
  let cursor = 0

  const writeSegment = (x0: number, z0: number, x1: number, z1: number, gain: number): void => {
    const y0 = terrainHeight(x0, z0, clusters)
    const y1 = terrainHeight(x1, z1, clusters)
    positions[cursor] = x0
    positions[cursor + 1] = y0
    positions[cursor + 2] = z0
    positions[cursor + 3] = x1
    positions[cursor + 4] = y1
    positions[cursor + 5] = z1
    writeColor(colors, cursor, nearestClusterColor(x0, z0, clusters), gain)
    writeColor(colors, cursor + 3, nearestClusterColor(x1, z1, clusters), gain)
    cursor += 6
  }

  for (let curve = 0; curve < curveCount; curve += 1) {
    const startX = xMin + rand() * (xMax - xMin)
    const startZ = zMin + rand() * (zMax - zMin)
    const family = rand()
    const angle = family < 0.45
      ? (rand() - 0.5) * 0.55
      : family < 0.76
        ? Math.PI * 0.5 + (rand() - 0.5) * 0.82
        : (rand() - 0.5) * Math.PI
    const length = 520 + Math.pow(rand(), 0.38) * 3500
    const normalX = -Math.sin(angle)
    const normalZ = Math.cos(angle)
    const phase = rand() * Math.PI * 2
    const bend = 30 + rand() * 145
    const slowWave = 1.2 + rand() * 0.12
    const gain = 0.050 + Math.pow(rand(), 0.44) * 0.10

    let prevX = startX - Math.cos(angle) * length * 0.5
    let prevZ = startZ - Math.sin(angle) * length * 0.5
    for (let step = 1; step < steps; step += 1) {
      const t = step / (steps - 1)
      const along = (t - 0.5) * length
      const curl =
        Math.sin(t * Math.PI * slowWave + phase) * bend +
        Math.sin(t * Math.PI * 5.2 + phase * 0.7) * bend * 0.22
      const nextX = startX + Math.cos(angle) * along + normalX * curl
      const nextZ = startZ + Math.sin(angle) * along + normalZ * curl
      writeSegment(prevX, prevZ, nextX, nextZ, gain)
      prevX = nextX
      prevZ = nextZ
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeBoundingSphere()
  return new THREE.LineSegments(geometry, createLineMaterial(uniforms))
}
