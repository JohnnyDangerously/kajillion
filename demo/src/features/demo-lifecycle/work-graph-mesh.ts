import { WORK_GROUPS } from './work-graph-types'

export function addWorkGraphMeshLinks (options: {
  addLink: (source: number, target: number, kind?: number, weight?: number, confidence?: number) => void;
  allCompanies: number[];
  allPeople: number[];
  companyIndicesByGroup: number[][];
  groupForNode: Int32Array;
  hubIndices: number[];
  nodeCount: number;
  peopleByGroup: number[][];
  rand: () => number;
}): void {
  const {
    addLink,
    allCompanies,
    allPeople,
    companyIndicesByGroup,
    groupForNode,
    hubIndices,
    nodeCount,
    peopleByGroup,
    rand,
  } = options
  for (let group = 0; group < WORK_GROUPS.length; group += 1) {
    const hub = hubIndices[group] ?? 0
    const nextHub = hubIndices[(group + 1) % hubIndices.length] ?? 0
    addLink(hub, nextHub, 0, 1.65, 0.72)
    const companies = companyIndicesByGroup[group] ?? []
    const nextCompanies = companyIndicesByGroup[(group + 1) % WORK_GROUPS.length] ?? []
    const companyCrossCount = Math.min(8, companies.length, nextCompanies.length)
    for (let i = 0; i < companyCrossCount; i += 1) {
      addLink(companies[Math.floor(rand() * companies.length)] ?? hub, nextCompanies[Math.floor(rand() * nextCompanies.length)] ?? nextHub, i % 2 === 0 ? 2 : 1, 0.82 + rand() * 0.62, 0.36 + rand() * 0.38)
    }
    const members = peopleByGroup[group] ?? []
    const nextMembers = peopleByGroup[(group + 1) % WORK_GROUPS.length] ?? []
    const crossCount = Math.min(Math.max(6, Math.floor(nodeCount * 0.006)), members.length, nextMembers.length)
    for (let i = 0; i < crossCount; i += 1) {
      addLink(members[Math.floor(rand() * members.length)] ?? hub, nextMembers[Math.floor(rand() * nextMembers.length)] ?? nextHub, i % 3 === 0 ? 2 : 1, 0.42 + rand() * 0.38, 0.28 + rand() * 0.42)
    }
  }

  const companyMeshCount = Math.min(Math.floor(nodeCount * 0.035), Math.max(0, allCompanies.length * 2))
  for (let i = 0; i < companyMeshCount; i += 1) {
    const a = allCompanies[Math.floor(rand() * allCompanies.length)] ?? 0
    let b = allCompanies[Math.floor(rand() * allCompanies.length)] ?? 0
    for (let guard = 0; guard < 4 && (a === b || groupForNode[a] === groupForNode[b]); guard += 1) {
      b = allCompanies[Math.floor(rand() * allCompanies.length)] ?? 0
    }
    addLink(a, b, i % 3 === 0 ? 2 : 1, 0.62 + rand() * 0.76, 0.34 + rand() * 0.42)
  }

  const personMeshCount = Math.min(Math.floor(nodeCount * 0.46), Math.max(0, allPeople.length))
  for (let i = 0; i < personMeshCount; i += 1) {
    const a = allPeople[Math.floor(rand() * allPeople.length)] ?? 0
    let b = allPeople[Math.floor(rand() * allPeople.length)] ?? 0
    const preferCrossGroup = i % 3 !== 0
    for (let guard = 0; guard < 5 && (a === b || (preferCrossGroup && groupForNode[a] === groupForNode[b])); guard += 1) {
      b = allPeople[Math.floor(rand() * allPeople.length)] ?? 0
    }
    const crossGroup = groupForNode[a] !== groupForNode[b]
    addLink(a, b, crossGroup ? (i % 5 === 0 ? 2 : 1) : 1, crossGroup ? 0.38 + rand() * 0.42 : 0.48 + rand() * 0.36, crossGroup ? 0.22 + rand() * 0.36 : 0.34 + rand() * 0.34)
  }
}
