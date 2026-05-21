import { DEMO_SPACE_SIZE, WORK_GROUP_LAYOUT } from './demo-space'
import { WORK_GROUPS, WORK_NODE_COMPANY, WORK_NODE_GROUP } from './work-graph-types'

function atlasHash (value: number, seed: number): number {
  let x = (Math.imul(value + 1, 2246822519) ^ Math.imul(seed + 101, 3266489917)) >>> 0
  x = Math.imul(x ^ (x >>> 15), 668265263) >>> 0
  return ((x ^ (x >>> 16)) >>> 0) / 0x1_0000_0000
}

function clampToField (value: number): number {
  return Math.max(180, Math.min(DEMO_SPACE_SIZE - 180, value))
}

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
  const layout = WORK_GROUP_LAYOUT[group] ?? { x: 0.5, y: 0.5 }
  const spec = WORK_GROUPS[group]!
  const centerX = layout.x * DEMO_SPACE_SIZE
  const centerY = layout.y * DEMO_SPACE_SIZE
  const clusterCount = Math.max(8, Math.min(72, Math.round(Math.sqrt(count) * 0.82)))
  const armCount = 4 + (group % 3)
  const centers: Array<{ x: number; y: number; weight: number }> = []
  for (let cluster = 0; cluster < clusterCount; cluster += 1) {
    const arm = cluster % armCount
    const depth = Math.floor(cluster / armCount) / Math.max(1, Math.ceil(clusterCount / armCount) - 1)
    const branch = spec.angle + (arm - (armCount - 1) / 2) * 0.42
    const curl = Math.sin(depth * 5.8 + group * 1.7) * 0.34
    const angle = branch + curl + (atlasHash(group * 811 + cluster, seed) - 0.5) * 0.22
    const radius = 240 + Math.pow(depth, 0.88) * (1420 + atlasHash(cluster + 313, seed) * 420)
    const tangent = (atlasHash(group * 997 + cluster * 17, seed) - 0.5) * (260 + depth * 440)
    centers.push({
      x: clampToField(centerX + Math.cos(angle) * radius + Math.cos(angle + Math.PI / 2) * tangent),
      y: clampToField(centerY + Math.sin(angle) * radius * 0.82 + Math.sin(angle + Math.PI / 2) * tangent),
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
  const radius = Math.sqrt(localIndex + 0.35) * spacing
  const lane = Math.sin(localIndex * 0.41 + seed * 0.011) * spacing * 0.75
  positions[node * 2] = clampToField(center.x + Math.cos(angle) * radius + Math.cos(angle + Math.PI / 2) * lane)
  positions[node * 2 + 1] = clampToField(center.y + Math.sin(angle) * radius * 0.84 + Math.sin(angle + Math.PI / 2) * lane)
}

function writeAtlasMember (
  positions: Float32Array,
  node: number,
  localIndex: number,
  company: number,
  seed: number,
  spacing: number,
): void {
  const cx = positions[company * 2] ?? DEMO_SPACE_SIZE / 2
  const cy = positions[company * 2 + 1] ?? DEMO_SPACE_SIZE / 2
  const angle = localIndex * 2.399963229728653 + (atlasHash(node * 29, seed) - 0.5) * 0.32
  const radius = 18 + Math.sqrt(localIndex + 0.65) * spacing
  positions[node * 2] = clampToField(cx + Math.cos(angle) * radius)
  positions[node * 2 + 1] = clampToField(cy + Math.sin(angle) * radius * 0.86)
}

function placeCompanies (
  positions: Float32Array,
  companies: number[],
  centers: Array<{ x: number; y: number }>,
  seed: number,
): void {
  const spacing = companies.length >= 420 ? 42 : 50
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
  const spacing = nodeCount >= 150000 ? 5.8 : 6.8
  for (const node of people) {
    const company = nodeCompany[node] ?? -1
    if (company > 0) {
      writeAtlasMember(positions, node, memberCounts[company]++, company, seed, spacing)
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
    const layout = WORK_GROUP_LAYOUT[group] ?? { x: 0.5, y: 0.5 }
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
