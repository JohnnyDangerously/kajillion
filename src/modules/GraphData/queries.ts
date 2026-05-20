import { type LinkAdjacencyList } from './types'

interface GraphQueryData {
  pointsNumber: number | undefined
  linksNumber: number | undefined
  links: Float32Array | undefined
  sourceIndexToTargetIndices: LinkAdjacencyList | undefined
  targetIndexToSourceIndices: LinkAdjacencyList | undefined
}

export function getNeighboringPointIndices (
  graphData: GraphQueryData,
  pointIndices: number | number[]
): number[] {
  const indices = Array.isArray(pointIndices) ? pointIndices : [pointIndices]
  const pointsNumber = graphData.pointsNumber ?? 0
  const result = new Set<number>()
  for (const index of indices) {
    if (index < 0 || index >= pointsNumber) continue
    for (const [pointIndex] of graphData.sourceIndexToTargetIndices?.[index] ?? []) result.add(pointIndex)
    for (const [pointIndex] of graphData.targetIndexToSourceIndices?.[index] ?? []) result.add(pointIndex)
  }
  return [...result]
}

export function getConnectedLinkIndices (
  graphData: GraphQueryData,
  pointIndices: number | number[]
): number[] {
  const indices = Array.isArray(pointIndices) ? pointIndices : [pointIndices]
  const pointsNumber = graphData.pointsNumber ?? 0
  const indexSet = new Set(indices)
  const result = new Set<number>()
  for (const index of indexSet) {
    if (index < 0 || index >= pointsNumber) continue
    for (const [targetIndex, linkIndex] of graphData.sourceIndexToTargetIndices?.[index] ?? []) {
      if (indexSet.has(targetIndex)) result.add(linkIndex)
    }
  }
  return [...result]
}

export function getConnectedPointIndices (
  graphData: GraphQueryData,
  linkIndices: number | number[]
): number[] {
  const indices = Array.isArray(linkIndices) ? linkIndices : [linkIndices]
  const result = new Set<number>()
  if (graphData.links === undefined) return []
  const linksNumber = graphData.linksNumber ?? 0
  for (const linkIndex of indices) {
    if (linkIndex < 0 || linkIndex >= linksNumber) continue
    const sourceIndex = graphData.links[linkIndex * 2]
    const targetIndex = graphData.links[linkIndex * 2 + 1]
    if (sourceIndex !== undefined) result.add(sourceIndex)
    if (targetIndex !== undefined) result.add(targetIndex)
  }
  return [...result]
}
