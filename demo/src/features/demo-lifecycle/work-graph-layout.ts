import { DEMO_SPACE_SIZE, WORK_GROUP_LAYOUT } from './demo-space'
import {
  WORK_GROUPS,
  WORK_NODE_COMPANY,
  WORK_NODE_GROUP,
} from './work-graph-types'
export { resolveWorkNodeOverlaps, seededUnit } from './work-graph-overlap'

function workOrganicJitter (value: number, seed: number): number {
  let x = (Math.imul(value + 1, 374761393) ^ Math.imul(seed + 17, 668265263)) >>> 0
  x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0
  return ((x ^ (x >>> 16)) >>> 0) / 0x1_0000_0000
}

export function organicRelayoutWorkNodes (
  positions: Float32Array,
  nodeKind: Uint8Array,
  nodeScore: Float32Array,
  groupForNode: Int32Array,
  seed: number
): void {
  const nodeCount = Math.floor(positions.length / 2)
  const center = DEMO_SPACE_SIZE / 2
  positions[0] = center
  positions[1] = center

  for (let group = 0; group < WORK_GROUPS.length; group += 1) {
    const spec = WORK_GROUPS[group]!
    const layout = WORK_GROUP_LAYOUT[group] ?? { x: 0.5, y: 0.5 }
    const groupNoise = workOrganicJitter(group, seed)
    const tangentNoise = workOrganicJitter(group + 97, seed) - 0.5
    const angle = spec.angle + (groupNoise - 0.5) * 0.18
    const tangent = angle + Math.PI / 2
    const clusterX = layout.x * DEMO_SPACE_SIZE + Math.cos(tangent) * tangentNoise * 220
    const clusterY = layout.y * DEMO_SPACE_SIZE + Math.sin(tangent) * tangentNoise * 180
    const rotation = spec.angle + (workOrganicJitter(group + 211, seed) - 0.5) * 0.42
    const cosR = Math.cos(rotation)
    const sinR = Math.sin(rotation)
    const groupNodes: number[] = []
    let hubIndex = -1
    for (let index = 1; index < nodeCount; index += 1) {
      if ((groupForNode[index] ?? -1) !== group) continue
      if (nodeKind[index] === WORK_NODE_GROUP) hubIndex = index
      else groupNodes.push(index)
    }
    if (hubIndex >= 0) {
      positions[hubIndex * 2] = Math.max(240, Math.min(DEMO_SPACE_SIZE - 240, clusterX))
      positions[hubIndex * 2 + 1] = Math.max(240, Math.min(DEMO_SPACE_SIZE - 240, clusterY))
    }

    groupNodes.sort((a, b) => {
      const aKind = nodeKind[a]
      const bKind = nodeKind[b]
      const aTier = aKind === WORK_NODE_COMPANY ? 2 : (nodeScore[a] ?? 0) > 0.62 ? 1 : 0
      const bTier = bKind === WORK_NODE_COMPANY ? 2 : (nodeScore[b] ?? 0) > 0.62 ? 1 : 0
      if (aTier !== bTier) return bTier - aTier
      return (nodeScore[b] ?? 0) - (nodeScore[a] ?? 0)
    })

    const sites: Array<{ x: number; y: number; rank: number }> = []
    const spacing = 80
    const minHubDistance = 230
    let ring = 1
    while (sites.length < groupNodes.length) {
      for (let q = -ring; q <= ring; q += 1) {
        for (let r = -ring; r <= ring; r += 1) {
          if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) !== ring) continue
          let localX = spacing * (q + r * 0.5)
          let localY = spacing * 0.8660254037844386 * r
          const distance = Math.hypot(localX, localY)
          if (distance < minHubDistance) continue
          const theta = Math.atan2(localY, localX)
          const hash = workOrganicJitter(group * 100_003 + q * 1_009 + r * 917, seed)
          const warp =
            Math.sin(theta * 3.0 + group * 0.83) * 10 +
            Math.sin(distance * 0.010 + group * 1.7) * 7
          localX += Math.cos(theta + Math.PI / 2) * warp + (hash - 0.5) * 6
          localY += Math.sin(theta + Math.PI / 2) * warp + (workOrganicJitter(group * 200_003 + q * 811 + r * 613, seed) - 0.5) * 6
          sites.push({
            x: localX,
            y: localY,
            rank: distance + hash * 70 + Math.sin(theta * 2 + group) * 45,
          })
        }
      }
      ring += 1
    }
    sites.sort((a, b) => a.rank - b.rank)

    for (let slot = 0; slot < groupNodes.length; slot += 1) {
      const index = groupNodes[slot]!
      const site = sites[slot] ?? { x: 0, y: 0 }
      const warpedX = site.x
      const warpedY = site.y
      const x = clusterX + warpedX * cosR - warpedY * sinR
      const y = clusterY + warpedX * sinR + warpedY * cosR
      positions[index * 2] = Math.max(220, Math.min(DEMO_SPACE_SIZE - 220, x))
      positions[index * 2 + 1] = Math.max(220, Math.min(DEMO_SPACE_SIZE - 220, y))
    }
  }
}

export function compactWorkNodesIntoSharedField (
  positions: Float32Array,
  nodeKind: Uint8Array,
  nodeScore: Float32Array,
  groupForNode: Int32Array,
  seed: number
): void {
  const nodeCount = Math.floor(positions.length / 2)
  const center = DEMO_SPACE_SIZE / 2
  const sites: Array<{ x: number; y: number }> = []
  const siteCount = nodeCount + 900
  const goldenAngle = 2.399963229728653
  for (let i = 0; i < siteCount; i += 1) {
    const hash = workOrganicJitter(i, seed)
    const theta = i * goldenAngle + Math.sin(i * 0.019 + seed * 0.01) * 0.19
    const radius = 80 + Math.sqrt(i + 0.8) * 43.5 + (hash - 0.5) * 34
    const warp =
      Math.sin(theta * 2.0 + radius * 0.006 + seed * 0.01) * 46 +
      Math.sin(theta * 5.0 + radius * 0.002) * 24
    const localX = Math.cos(theta) * radius + Math.cos(theta + Math.PI / 2) * warp + (hash - 0.5) * 22
    const localY = Math.sin(theta) * radius + Math.sin(theta + Math.PI / 2) * warp + (workOrganicJitter(i + 503, seed) - 0.5) * 22
    sites.push({ x: center + localX, y: center + localY })
  }

  const used = new Uint8Array(sites.length)
  positions[0] = center
  positions[1] = center
  const assignSite = (node: number, siteIndex: number): void => {
    used[siteIndex] = 1
    const site = sites[siteIndex]!
    const kind = nodeKind[node]
    const nodeScatter = kind === WORK_NODE_GROUP
      ? 18
      : kind === WORK_NODE_COMPANY
        ? 28
        : (nodeScore[node] ?? 0) > 0.62
          ? 34
          : 46
    const theta = workOrganicJitter(node * 131 + siteIndex * 17, seed) * Math.PI * 2
    const radius = Math.sqrt(workOrganicJitter(node * 197 + siteIndex * 29, seed)) * nodeScatter
    const curl = Math.sin(site.x * 0.0037 + site.y * 0.0029 + seed * 0.01) * nodeScatter * 0.34
    const x = site.x + Math.cos(theta) * radius + Math.cos(theta + Math.PI / 2) * curl
    const y = site.y + Math.sin(theta) * radius + Math.sin(theta + Math.PI / 2) * curl
    positions[node * 2] = Math.max(220, Math.min(DEMO_SPACE_SIZE - 220, x))
    positions[node * 2 + 1] = Math.max(220, Math.min(DEMO_SPACE_SIZE - 220, y))
  }

  for (let group = 0; group < WORK_GROUPS.length; group += 1) {
    const focal = WORK_GROUP_LAYOUT[group] ?? { x: 0.5, y: 0.5 }
    const focalX = focal.x * DEMO_SPACE_SIZE
    const focalY = focal.y * DEMO_SPACE_SIZE
    const siteOrder = sites
      .map((site, index) => {
        const dx = site.x - focalX
        const dy = site.y - focalY
        const centerDx = site.x - center
        const centerDy = site.y - center
        return {
          index,
          rank: Math.hypot(dx, dy) + Math.hypot(centerDx, centerDy) * 0.035 + workOrganicJitter(index + group * 11_111, seed) * 180,
        }
      })
      .sort((a, b) => a.rank - b.rank)
    const groupNodes: number[] = []
    for (let index = 1; index < nodeCount; index += 1) {
      if ((groupForNode[index] ?? -1) === group) groupNodes.push(index)
    }
    groupNodes.sort((a, b) => {
      const aKind = nodeKind[a]
      const bKind = nodeKind[b]
      const aTier = aKind === WORK_NODE_GROUP ? 3 : aKind === WORK_NODE_COMPANY ? 2 : (nodeScore[a] ?? 0) > 0.62 ? 1 : 0
      const bTier = bKind === WORK_NODE_GROUP ? 3 : bKind === WORK_NODE_COMPANY ? 2 : (nodeScore[b] ?? 0) > 0.62 ? 1 : 0
      if (aTier !== bTier) return bTier - aTier
      return (nodeScore[b] ?? 0) - (nodeScore[a] ?? 0)
    })
    let cursor = 0
    for (const node of groupNodes) {
      while (cursor < siteOrder.length && used[siteOrder[cursor]!.index]) cursor += 1
      const siteIndex = siteOrder[cursor]?.index
      if (siteIndex === undefined) break
      assignSite(node, siteIndex)
      cursor += 1
    }
  }
}
