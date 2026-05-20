import { hash01 } from './utils'
import type { GalleryGraphData } from './types'

export function subnetScene<T extends GalleryGraphData> (data: T, spaceSize: number): T {
  const positions = new Float32Array(data.positions.length)
  const nodeCount = data.nodeCount
  const center = spaceSize / 2
  const groupForNode = new Int32Array(nodeCount)
  const groups = 7
  const clusterAngles = [-2.58, -1.88, -0.82, 0.00, 0.78, 1.62, 2.46]
  const clusterRadii = [1760, 1780, 1670, 1760, 1700, 1650, 1780]
  const hubIndices: number[] = []
  const membersByGroup: number[][] = Array.from({ length: groups }, () => [])
  positions[0] = center
  positions[1] = center
  groupForNode[0] = -1
  let cursor = 1
  for (let group = 0; group < groups && cursor < nodeCount; group += 1) {
    const angle = clusterAngles[group] ?? 0
    positions[cursor * 2] = center + Math.cos(angle) * (clusterRadii[group] ?? 1700) * 0.40
    positions[cursor * 2 + 1] = center + Math.sin(angle) * (clusterRadii[group] ?? 1700) * 0.34
    groupForNode[cursor] = group
    hubIndices[group] = cursor
    cursor += 1
  }
  while (cursor < nodeCount) {
    const group = (cursor - 1) % groups
    const hub = hubIndices[group] ?? 0
    const ordinal = membersByGroup[group]!.length
    const angle = (clusterAngles[group] ?? 0) + (ordinal * 2.399963229728653) + (hash01(cursor) - 0.5) * 0.56
    const ring = Math.floor(ordinal / 18)
    const r = 170 + ring * 80 + Math.sqrt(hash01(cursor + 23)) * 260
    const stretch = group === 0 || group === 3 ? 1.34 : 1.08
    positions[cursor * 2] = (positions[hub * 2] ?? center) + Math.cos(angle) * r * stretch
    positions[cursor * 2 + 1] = (positions[hub * 2 + 1] ?? center) + Math.sin(angle) * r * 0.82
    groupForNode[cursor] = group
    membersByGroup[group]!.push(cursor)
    cursor += 1
  }

  const links: number[] = []
  const addLink = (a: number, b: number): void => {
    if (a === b || a < 0 || b < 0 || a >= nodeCount || b >= nodeCount) return
    links.push(a, b)
  }
  for (let group = 0; group < groups; group += 1) {
    const hub = hubIndices[group] ?? 0
    addLink(0, hub)
    const members = membersByGroup[group] ?? []
    for (let i = 0; i < members.length; i += 1) {
      const node = members[i]!
      addLink(hub, node)
      if (i > 0) addLink(members[i - 1]!, node)
      if (i > 4 && i % 2 === 0) addLink(members[(i + members.length - 5) % members.length]!, node)
      if (i % 9 === 0) addLink(node, members[Math.floor(hash01(node + 707) * members.length)] ?? hub)
    }
  }
  for (let group = 0; group < groups; group += 1) {
    addLink(hubIndices[group] ?? 0, hubIndices[(group + 1) % groups] ?? 0)
    if (group % 2 === 0) addLink(hubIndices[group] ?? 0, hubIndices[(group + 2) % groups] ?? 0)
  }
  const out = { ...data, positions, links: new Float32Array(links), edgeCount: links.length / 2 }
  ;(out as GalleryGraphData & { groupForNode?: Int32Array }).groupForNode = groupForNode
  return out
}
