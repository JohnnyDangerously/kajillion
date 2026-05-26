import { atlasHash } from '../atlas-reference/metrics'
import { ATLAS_CLUSTERS, type AtlasCluster } from './layout-clusters'
import { PackGrid } from './layout-grid'
import { atlasRadius, unitRadius } from './layout-radius'
import type { CloudNode } from './types'

const BODY_SCALE = 1.30

interface NodeSpec {
  id: number;
  cluster: number;
  group: number;
  radius: number;
}

export function packAtlasNodes (target: number, seed: number): CloudNode[] {
  const specs = nodeSpecs(target, seed)
  const grid = new PackGrid(0.075)
  const nodes: CloudNode[] = []
  for (const spec of specs) {
    const placed = placeSpec(spec, grid, seed)
    if (!placed) continue
    grid.add({ x: placed.x, y: placed.y, r: unitRadius(spec.radius) })
    nodes.push({ ...spec, ...placed, z: visualDepth(spec, placed, seed), bridge: false, importance: 1 - nodes.length / target })
  }
  return nodes
}

function nodeSpecs (target: number, seed: number): NodeSpec[] {
  const totalWeight = ATLAS_CLUSTERS.reduce((sum, cluster) => sum + cluster.weight, 0)
  const specs: NodeSpec[] = []
  let id = 1
  for (let c = 0; c < ATLAS_CLUSTERS.length; c += 1) {
    const count = Math.round(target * ATLAS_CLUSTERS[c]!.weight / totalWeight)
    for (let i = 0; i < count; i += 1) specs.push({ id: id++, cluster: c, group: ATLAS_CLUSTERS[c]!.group, radius: atlasRadius(id, seed) })
  }
  return specs.sort((a, b) => b.radius - a.radius || atlasHash(a.id * 17, seed) - atlasHash(b.id * 17, seed))
}

function placeSpec (spec: NodeSpec, grid: PackGrid, seed: number): { x: number; y: number } | null {
  const cluster = ATLAS_CLUSTERS[spec.cluster]!
  const r = unitRadius(spec.radius)
  const attempts = spec.radius > 5 ? 220 : 340
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const p = candidate(cluster, spec.id, attempt, seed)
    if (insideCluster(cluster, p.x, p.y, r) && grid.canPlace({ x: p.x, y: p.y, r })) return p
  }
  return null
}

function candidate (cluster: AtlasCluster, id: number, attempt: number, seed: number): { x: number; y: number } {
  const island = Math.floor(atlasHash(id * 17 + attempt * 31, seed) * 7)
  const islandAngle = cluster.angle + island * Math.PI * 0.46 + atlasHash(island * 43 + id, seed) * 0.52
  const islandR = island === 0 ? 0 : 0.10 + atlasHash(island * 47 + id, seed) * 0.54
  const localAngle = atlasHash(id * 11 + attempt * 97, seed) * Math.PI * 2
  const localCore = atlasHash(id * 13 + attempt * 101, seed) ** 0.42
  const tendril = atlasHash(id * 29 + attempt * 7, seed) < 0.16
  const rx = cluster.rx * BODY_SCALE
  const ry = cluster.ry * BODY_SCALE
  const localX = Math.cos(localAngle) * rx * localCore * (tendril ? 0.22 : 0.42)
  const localY = Math.sin(localAngle) * ry * localCore * (tendril ? 0.09 : 0.34)
  const lx = Math.cos(islandAngle) * rx * islandR + localX
  const ly = Math.sin(islandAngle) * ry * islandR + localY
  const ca = Math.cos(cluster.angle)
  const sa = Math.sin(cluster.angle)
  return {
    x: cluster.x + lx * ca - ly * sa,
    y: cluster.y + lx * sa + ly * ca,
  }
}

function insideCluster (cluster: AtlasCluster, x: number, y: number, r: number): boolean {
  const dx = x - cluster.x
  const dy = y - cluster.y
  const ca = Math.cos(-cluster.angle)
  const sa = Math.sin(-cluster.angle)
  const lx = dx * ca - dy * sa
  const ly = dx * sa + dy * ca
  const nx = lx / Math.max(0.01, cluster.rx * BODY_SCALE - r)
  const ny = ly / Math.max(0.01, cluster.ry * BODY_SCALE - r)
  return nx * nx + ny * ny <= 1
}

function visualDepth (spec: NodeSpec, p: { x: number; y: number }, seed: number): number {
  const cluster = ATLAS_CLUSTERS[spec.cluster]!
  const clusterBand = (atlasHash((spec.cluster + 1) * 137, seed) - 0.5) * 1.05
  const rankLift = Math.min(0.55, spec.radius / 17)
  const plane = p.y * -0.38 + p.x * 0.14
  return clusterBand + rankLift + plane + (atlasHash(spec.id * 149, seed) - 0.5) * 0.28
}
