import type { GeneratedGraph } from '../../generate-graph'
import {
  DEMO_SPACE_SIZE,
  WORK_COMPANY_NAMES,
  WORK_FIRST_NAMES,
  WORK_LAST_NAMES,
} from './demo-space'
import {
  buildGeneratedWorkGraph,
  createWorkGraphBuilder,
} from './work-graph-builder'
import {
  compactWorkNodesIntoSharedField,
  organicRelayoutWorkNodes,
  resolveWorkNodeOverlaps,
  seededUnit,
} from './work-graph-layout'
import { atlasRelayoutWorkNodes } from './work-graph-atlas'
import { addWorkGraphMeshLinks } from './work-graph-mesh'
import {
  WORK_GROUPS,
  WORK_NODE_COMPANY,
  WORK_NODE_GROUP,
  WORK_NODE_PERSON,
  WORK_NODE_ROOT,
} from './work-graph-types'

export { scaleGeneratedDataToDemoSpace } from './work-graph-scale'

export function generateWorkGraph (count: number, seed: number): GeneratedGraph {
  const nodeCount = Math.max(64, count)
  const rand = seededUnit(seed)
  const center = DEMO_SPACE_SIZE / 2
  const builder = createWorkGraphBuilder(nodeCount)
  const {
    positions,
    groupForNode,
    nodeKind,
    nodeScore,
    nodeCompany,
    nodeLabels,
    nodeSubtitles,
    addLink,
  } = builder

  positions[0] = center
  positions[1] = center
  groupForNode[0] = -1
  nodeKind[0] = WORK_NODE_ROOT
  nodeScore[0] = 1
  nodeLabels[0] = 'VIA'
  nodeSubtitles[0] = 'CRM relationship graph'

  const hubIndices: number[] = []
  let cursor = 1
  for (let group = 0; group < WORK_GROUPS.length && cursor < nodeCount; group += 1) {
    const spec = WORK_GROUPS[group]!
    const skew = Math.sin(group * 1.71 + seed * 0.013) * 0.11
    const x = center + Math.cos(spec.angle + skew) * spec.radius * 0.34 + (rand() - 0.5) * 180
    const y = center + Math.sin(spec.angle - skew * 0.6) * spec.radius * 0.29 + (rand() - 0.5) * 160
    positions[cursor * 2] = x
    positions[cursor * 2 + 1] = y
    groupForNode[cursor] = group
    nodeKind[cursor] = WORK_NODE_GROUP
    nodeScore[cursor] = 0.78 + group * 0.02
    nodeLabels[cursor] = spec.label
    nodeSubtitles[cursor] = 'relationship segment'
    hubIndices.push(cursor)
    addLink(0, cursor, 0, 3.4, 0.98)
    cursor += 1
  }

  const companyIndicesByGroup: number[][] = WORK_GROUPS.map(() => [])
  const companyMembers: number[][] = Array.from({ length: nodeCount }, () => [])
  const companyTarget = Math.min(
    Math.max(0, nodeCount - cursor),
    Math.max(WORK_GROUPS.length * 3, Math.round(nodeCount * 0.035))
  )
  for (let ordinal = 0; ordinal < companyTarget && cursor < nodeCount; ordinal += 1) {
    const group = ordinal % WORK_GROUPS.length
    const spec = WORK_GROUPS[group]!
    const hub = hubIndices[group] ?? 0
    const groupOrdinal = companyIndicesByGroup[group]!.length
    const lane = ((groupOrdinal * 5) % 13) / 13
    const ring = Math.floor(groupOrdinal / 8)
    const angle = spec.angle + (lane - 0.5) * 1.42 + ring * 0.19 + (rand() - 0.5) * 0.38
    const radius = 330 + ring * 185 + rand() * 160
    const tangent = (rand() - 0.5) * 360
    const companyName = WORK_COMPANY_NAMES[(ordinal + group * 5) % WORK_COMPANY_NAMES.length] ?? `Account ${ordinal + 1}`
    const companyX = (positions[hub * 2] ?? center) + Math.cos(angle) * radius + Math.cos(spec.angle + Math.PI / 2) * tangent
    const companyY = (positions[hub * 2 + 1] ?? center) + Math.sin(angle) * radius * 0.92 + Math.sin(spec.angle + Math.PI / 2) * tangent
    const companyCenterPull = 0.07 + Math.min(0.10, ring * 0.012)
    positions[cursor * 2] = Math.max(260, Math.min(DEMO_SPACE_SIZE - 260, companyX * (1 - companyCenterPull) + center * companyCenterPull))
    positions[cursor * 2 + 1] = Math.max(260, Math.min(DEMO_SPACE_SIZE - 260, companyY * (1 - companyCenterPull) + center * companyCenterPull))
    groupForNode[cursor] = group
    nodeKind[cursor] = WORK_NODE_COMPANY
    nodeScore[cursor] = 0.56 + rand() * 0.28
    nodeCompany[cursor] = cursor
    nodeLabels[cursor] = companyName
    nodeSubtitles[cursor] = `${spec.label} account`
    companyIndicesByGroup[group]!.push(cursor)
    addLink(hub, cursor, 0, 2.4 + rand() * 0.7, 0.92)
    if (groupOrdinal > 0 && groupOrdinal % 3 === 0) addLink(companyIndicesByGroup[group]![groupOrdinal - 1]!, cursor, 1, 0.95, 0.42 + rand() * 0.24)
    if (ordinal % 11 === 0) addLink(0, cursor, 0, 2.0, 0.84)
    cursor += 1
  }

  const peopleByGroup: number[][] = WORK_GROUPS.map(() => [])
  while (cursor < nodeCount) {
    const group = (cursor - 1 + Math.floor(rand() * WORK_GROUPS.length)) % WORK_GROUPS.length
    const spec = WORK_GROUPS[group]!
    const companies = companyIndicesByGroup[group] ?? []
    const company = companies.length > 0
      ? companies[Math.floor(rand() * companies.length)]!
      : hubIndices[group] ?? 0
    const ordinal = companyMembers[company]!.length
    const angle = ordinal * 2.399963229728653 + rand() * 0.20
    const radius = 112 + Math.sqrt(ordinal + 0.5) * 78 + rand() * 24
    const stretch = 1.03 + ((group % 3) - 1) * 0.10
    const bridgePull = Math.min(0.20, 0.045 + Math.sqrt(ordinal + 1) * 0.006)
    const swirl = Math.sin((ordinal + 1) * 0.77 + group * 1.31) * 36
    const rawX = (positions[company * 2] ?? center) + Math.cos(angle) * radius * stretch + Math.cos(spec.angle) * swirl
    const rawY = (positions[company * 2 + 1] ?? center) + Math.sin(angle) * radius * 0.92 + Math.sin(spec.angle) * swirl
    const x = rawX * (1 - bridgePull) + center * bridgePull + (rand() - 0.5) * 42
    const y = rawY * (1 - bridgePull) + center * bridgePull + (rand() - 0.5) * 42
    positions[cursor * 2] = Math.max(220, Math.min(DEMO_SPACE_SIZE - 220, x))
    positions[cursor * 2 + 1] = Math.max(220, Math.min(DEMO_SPACE_SIZE - 220, y))
    groupForNode[cursor] = group
    nodeKind[cursor] = WORK_NODE_PERSON
    nodeScore[cursor] = 0.18 + rand() * 0.50
    nodeCompany[cursor] = company
    const first = WORK_FIRST_NAMES[(cursor + group * 3) % WORK_FIRST_NAMES.length] ?? 'Alex'
    const last = WORK_LAST_NAMES[(cursor * 7 + group) % WORK_LAST_NAMES.length] ?? 'Stone'
    nodeLabels[cursor] = `${first} ${last}`
    nodeSubtitles[cursor] = `${spec.label} · ${nodeLabels[company] ?? 'Account'}`
    companyMembers[company]!.push(cursor)
    peopleByGroup[group]!.push(cursor)
    addLink(company, cursor, 0, 1.10 + rand() * 0.72, 0.72 + rand() * 0.20)
    if (ordinal > 0) addLink(companyMembers[company]![ordinal - 1]!, cursor, 0, 0.74 + rand() * 0.46, 0.58)
    if (ordinal > 3 && rand() > 0.52) addLink(companyMembers[company]![Math.floor(rand() * ordinal)]!, cursor, 1, 0.52 + rand() * 0.42, 0.34 + rand() * 0.30)
    if (ordinal > 11 && ordinal % 13 === 0) addLink(companyMembers[company]![Math.max(0, ordinal - 9)]!, cursor, 1, 0.64, 0.40)
    cursor += 1
  }

  const allPeople = peopleByGroup.flat()
  const allCompanies = companyIndicesByGroup.flat()
  addWorkGraphMeshLinks({
    addLink,
    allCompanies,
    allPeople,
    companyIndicesByGroup,
    groupForNode,
    hubIndices,
    nodeCount,
    peopleByGroup,
    rand,
  })

  if (nodeCount >= 50000) {
    atlasRelayoutWorkNodes(positions, nodeKind, nodeScore, groupForNode, nodeCompany, seed)
  } else {
    organicRelayoutWorkNodes(positions, nodeKind, nodeScore, groupForNode, seed)
    compactWorkNodesIntoSharedField(positions, nodeKind, nodeScore, groupForNode, seed)
    resolveWorkNodeOverlaps(positions, nodeKind, nodeScore)
  }

  return buildGeneratedWorkGraph(builder)
}
