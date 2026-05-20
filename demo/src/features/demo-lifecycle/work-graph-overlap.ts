import { DEMO_SPACE_SIZE } from './demo-space'
import {
  WORK_NODE_COMPANY,
  WORK_NODE_GROUP,
  WORK_NODE_ROOT,
} from './work-graph-types'

export function seededUnit (seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
}

function minDistanceForNode (
  index: number,
  nodeKind: Uint8Array,
  nodeScore: Float32Array,
): number {
  const kind = nodeKind[index]
  if (kind === WORK_NODE_ROOT) return 0
  if (kind === WORK_NODE_GROUP) return 156
  if (kind === WORK_NODE_COMPANY) return 118
  return (nodeScore[index] ?? 0) > 0.62 ? 88 : 72
}

function buildSpatialGrid (
  positions: Float32Array,
  nodeCount: number,
  cellSize: number,
  center: number,
): Map<string, number[]> {
  const grid = new Map<string, number[]>()
  for (let index = 1; index < nodeCount; index += 1) {
    const x = positions[index * 2] ?? center
    const y = positions[index * 2 + 1] ?? center
    const key = `${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}`
    const bucket = grid.get(key)
    if (bucket) bucket.push(index)
    else grid.set(key, [index])
  }
  return grid
}

function pushOverlappingNodes (
  positions: Float32Array,
  nodeKind: Uint8Array,
  nodeScore: Float32Array,
  grid: Map<string, number[]>,
  cellSize: number,
  center: number,
  pass: number,
  pushScale: number,
  angleSalt: number,
): void {
  const nodeCount = Math.floor(positions.length / 2)
  for (let index = 1; index < nodeCount; index += 1) {
    const ax = positions[index * 2] ?? center
    const ay = positions[index * 2 + 1] ?? center
    const acx = Math.floor(ax / cellSize)
    const acy = Math.floor(ay / cellSize)
    for (let gx = acx - 1; gx <= acx + 1; gx += 1) {
      for (let gy = acy - 1; gy <= acy + 1; gy += 1) {
        const bucket = grid.get(`${gx}:${gy}`)
        if (!bucket) continue
        for (const other of bucket) {
          if (other <= index) continue
          repelPair({
            positions,
            nodeKind,
            nodeScore,
            index,
            other,
            center,
            pass,
            pushScale,
            angleSalt,
          })
        }
      }
    }
  }
}

interface RepelPairInput {
  positions: Float32Array;
  nodeKind: Uint8Array;
  nodeScore: Float32Array;
  index: number;
  other: number;
  center: number;
  pass: number;
  pushScale: number;
  angleSalt: number;
}

function repelPair (input: RepelPairInput): void {
  const { positions, nodeKind, nodeScore, index, other, center, pass, pushScale, angleSalt } = input
  const ax = positions[index * 2] ?? center
  const ay = positions[index * 2 + 1] ?? center
  const bx = positions[other * 2] ?? center
  const by = positions[other * 2 + 1] ?? center
  let dx = bx - ax
  let dy = by - ay
  let distSq = dx * dx + dy * dy
  if (distSq < 0.0001) {
    const angle = ((index * angleSalt + other * 364479 + pass * 92821) % 6283) / 1000
    dx = Math.cos(angle)
    dy = Math.sin(angle)
    distSq = 1
  }
  const minDistance = (minDistanceForNode(index, nodeKind, nodeScore) + minDistanceForNode(other, nodeKind, nodeScore)) * 0.5
  if (distSq >= minDistance * minDistance) return
  const dist = Math.sqrt(distSq)
  const push = (minDistance - dist) * pushScale
  const nx = dx / dist
  const ny = dy / dist
  positions[index * 2] = Math.max(180, Math.min(DEMO_SPACE_SIZE - 180, (positions[index * 2] ?? ax) - nx * push))
  positions[index * 2 + 1] = Math.max(180, Math.min(DEMO_SPACE_SIZE - 180, (positions[index * 2 + 1] ?? ay) - ny * push))
  positions[other * 2] = Math.max(180, Math.min(DEMO_SPACE_SIZE - 180, bx + nx * push))
  positions[other * 2 + 1] = Math.max(180, Math.min(DEMO_SPACE_SIZE - 180, by + ny * push))
}

export function resolveWorkNodeOverlaps (
  positions: Float32Array,
  nodeKind: Uint8Array,
  nodeScore: Float32Array,
  iterations = 36,
): void {
  const nodeCount = Math.floor(positions.length / 2)
  const cellSize = 172
  const center = DEMO_SPACE_SIZE / 2
  const original = new Float32Array(positions)
  for (let pass = 0; pass < iterations; pass += 1) {
    const grid = buildSpatialGrid(positions, nodeCount, cellSize, center)
    pushOverlappingNodes(
      positions,
      nodeKind,
      nodeScore,
      grid,
      cellSize,
      center,
      pass,
      pass < 3 ? 0.72 : 0.58,
      928371,
    )
    const anchorPull = pass < iterations - 1 ? 0.010 : 0.004
    for (let index = 1; index < nodeCount; index += 1) {
      positions[index * 2] = (positions[index * 2] ?? center) * (1 - anchorPull) + (original[index * 2] ?? center) * anchorPull
      positions[index * 2 + 1] = (positions[index * 2 + 1] ?? center) * (1 - anchorPull) + (original[index * 2 + 1] ?? center) * anchorPull
    }
  }

  for (let pass = 0; pass < 16; pass += 1) {
    pushOverlappingNodes(
      positions,
      nodeKind,
      nodeScore,
      buildSpatialGrid(positions, nodeCount, cellSize, center),
      cellSize,
      center,
      pass,
      0.62,
      742939,
    )
  }
}
