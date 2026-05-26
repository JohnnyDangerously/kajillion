import { DEMO_SPACE_SIZE } from './demo-space'
import { atlasGroupLayout, atlasHash, chooseAtlasCenter, clampAtlasField } from './work-graph-atlas-center'
import { WORK_GROUPS, WORK_NODE_COMPANY, WORK_NODE_GROUP } from './work-graph-types'

function groupNodeRank (node: number, nodeKind: Uint8Array, nodeScore: Float32Array): number {
  const kind = nodeKind[node]
  const score = nodeScore[node] ?? 0
  return kind === WORK_NODE_GROUP ? 4 : kind === WORK_NODE_COMPANY ? 3 : score > 0.68 ? 2 : score > 0.45 ? 1 : 0
}

function buildClusterCenters (
  group: number,
  count: number,
  seed: number,
): Array<{ x: number; y: number; weight: number }> {
  const clusterCount = Math.max(36, Math.min(220, Math.round(Math.sqrt(count) * 4.6)))
  const centers: Array<{ x: number; y: number; weight: number }> = []
  for (let cluster = 0; cluster < clusterCount; cluster += 1) {
    let base = chooseAtlasCenter(group, cluster, seed)
    let bestScore = -Infinity
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const candidate = chooseAtlasCenter(group, cluster + attempt * 41, seed)
      const gap = centers.reduce((best, center) => {
        const dx = candidate.x - center.x
        const dy = candidate.y - center.y
        return Math.min(best, Math.sqrt(dx * dx + dy * dy))
      }, 9999)
      const score = Math.min(gap, 320) - Math.abs(gap - 170) * 0.30
      if (score > bestScore) {
        base = candidate
        bestScore = score
      }
    }
    const angle = atlasHash(group * 811 + cluster * 7, seed) * Math.PI * 2
    const radius = Math.pow(atlasHash(cluster + 313, seed), 1.65) * 42
    centers.push({
      x: clampAtlasField(base.x + Math.cos(angle) * radius),
      y: clampAtlasField(base.y + Math.sin(angle) * radius * 0.72),
      weight: 0.55 + Math.pow(atlasHash(group * 1231 + cluster * 37, seed), 1.65) * 2.9,
    })
  }
  return centers
}

function writeAtlasNode (
  positions: Float32Array,
  node: number,
  localIndex: number,
  center: { x: number; y: number },
  seed: number,
  spacing: number,
): void {
  const golden = 2.399963229728653
  const angle = localIndex * golden + (atlasHash(node * 19 + localIndex, seed) - 0.5) * 0.20
  const radius = Math.sqrt(localIndex + 0.35) * spacing * 0.88
  const lane = Math.sin(localIndex * 0.41 + seed * 0.011) * spacing * 0.45
  positions[node * 2] = clampAtlasField(center.x + Math.cos(angle) * radius + Math.cos(angle + Math.PI / 2) * lane)
  positions[node * 2 + 1] = clampAtlasField(center.y + Math.sin(angle) * radius * 0.84 + Math.sin(angle + Math.PI / 2) * lane)
}

function writeAtlasMember (
  positions: Float32Array,
  node: number,
  localIndex: number,
  company: number,
  groupCenter: { x: number; y: number },
  seed: number,
  spacing: number,
): void {
  const cx = positions[company * 2] ?? DEMO_SPACE_SIZE / 2
  const cy = positions[company * 2 + 1] ?? DEMO_SPACE_SIZE / 2
  const bridge = atlasHash(node * 41 + localIndex, seed)
  if (bridge > 0.88) {
    const t = 0.24 + atlasHash(node * 43, seed) * 0.68
    const jitter = (atlasHash(node * 47, seed) - 0.5) * spacing * 5.2
    const targetX = bridge > 0.96 ? DEMO_SPACE_SIZE / 2 : groupCenter.x
    const targetY = bridge > 0.96 ? DEMO_SPACE_SIZE / 2 : groupCenter.y
    const ix = cx + (targetX - cx) * t
    const iy = cy + (targetY - cy) * t
    const angleToCenter = Math.atan2(targetY - cy, targetX - cx) + Math.PI / 2
    positions[node * 2] = clampAtlasField(ix + Math.cos(angleToCenter) * jitter)
    positions[node * 2 + 1] = clampAtlasField(iy + Math.sin(angleToCenter) * jitter)
    return
  }
  const angle = localIndex * 2.399963229728653 + (atlasHash(node * 29, seed) - 0.5) * 0.32
  const radius = 14 + Math.sqrt(localIndex + 0.65) * spacing * 0.66
  const wobble = (atlasHash(node * 31 + localIndex, seed) - 0.5) * spacing * 1.35
  positions[node * 2] = clampAtlasField(cx + Math.cos(angle) * radius + Math.cos(angle + Math.PI / 2) * wobble)
  positions[node * 2 + 1] = clampAtlasField(cy + Math.sin(angle) * radius * 0.86 + Math.sin(angle + Math.PI / 2) * wobble)
}

function placeCompanies (
  positions: Float32Array,
  companies: number[],
  centers: Array<{ x: number; y: number }>,
  seed: number,
): void {
  const spacing = companies.length >= 420 ? 34 : 48
  for (let i = 0; i < companies.length; i += 1) {
    const center = centers[i % centers.length]!
    writeAtlasNode(positions, companies[i]!, Math.floor(i / centers.length), center, seed, spacing)
  }
}

function placePeople (
  positions: Float32Array,
  people: number[],
  nodeCompany: Int32Array,
  groupCenter: { x: number; y: number },
  seed: number,
  nodeCount: number,
): void {
  const memberCounts = new Int32Array(nodeCount)
  const spacing = nodeCount >= 150000 ? 8.2 : nodeCount >= 50000 ? 9.2 : 10.4
  for (const node of people) {
    const company = nodeCompany[node] ?? -1
    if (company > 0) {
      writeAtlasMember(positions, node, memberCounts[company]++, company, groupCenter, seed, spacing)
    } else {
      writeAtlasNode(positions, node, node, groupCenter, seed, spacing)
    }
  }
}

export function atlasRelayoutWorkNodes (
  positions: Float32Array,
  nodeKind: Uint8Array,
  nodeScore: Float32Array,
  groupForNode: Int32Array,
  nodeCompany: Int32Array,
  seed: number,
): void {
  const nodeCount = Math.floor(positions.length / 2)
  const center = DEMO_SPACE_SIZE / 2
  positions[0] = center
  positions[1] = center
  for (let group = 0; group < WORK_GROUPS.length; group += 1) {
    const hubs: number[] = []
    const companies: number[] = []
    const people: number[] = []
    for (let node = 1; node < nodeCount; node += 1) {
      if ((groupForNode[node] ?? -1) !== group) continue
      const kind = nodeKind[node]
      if (kind === WORK_NODE_GROUP) hubs.push(node)
      else if (kind === WORK_NODE_COMPANY) companies.push(node)
      else people.push(node)
    }
    companies.sort((a, b) => {
      const tier = groupNodeRank(b, nodeKind, nodeScore) - groupNodeRank(a, nodeKind, nodeScore)
      return tier !== 0 ? tier : (nodeScore[b] ?? 0) - (nodeScore[a] ?? 0)
    })
    const layout = atlasGroupLayout(group)
    const groupCenter = { x: layout.x * DEMO_SPACE_SIZE, y: layout.y * DEMO_SPACE_SIZE }
    for (const hub of hubs) {
      positions[hub * 2] = groupCenter.x
      positions[hub * 2 + 1] = groupCenter.y
    }
    const centers = buildClusterCenters(group, companies.length, seed)
    placeCompanies(positions, companies, centers, seed)
    placePeople(positions, people, nodeCompany, groupCenter, seed, nodeCount)
  }
}
