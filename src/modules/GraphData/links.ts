import { type LinkAdjacencyList } from './types'

export function createAdjacencyLists (
  links: Float32Array | undefined,
  linksNumber: number | undefined,
  pointsNumber: number | undefined
): {
    sourceIndexToTargetIndices: LinkAdjacencyList | undefined;
    targetIndexToSourceIndices: LinkAdjacencyList | undefined;
  } {
  if (linksNumber === undefined || links === undefined) {
    return {
      sourceIndexToTargetIndices: undefined,
      targetIndexToSourceIndices: undefined,
    }
  }

  const sourceIndexToTargetIndices: LinkAdjacencyList = new Array(pointsNumber).fill(undefined)
  const targetIndexToSourceIndices: LinkAdjacencyList = new Array(pointsNumber).fill(undefined)

  for (let i = 0; i < linksNumber; i++) {
    const sourceIndex = links[i * 2]
    const targetIndex = links[i * 2 + 1]
    if (sourceIndex !== undefined && targetIndex !== undefined) {
      if (sourceIndexToTargetIndices[sourceIndex] === undefined) sourceIndexToTargetIndices[sourceIndex] = []
      sourceIndexToTargetIndices[sourceIndex]?.push([targetIndex, i])

      if (targetIndexToSourceIndices[targetIndex] === undefined) targetIndexToSourceIndices[targetIndex] = []
      targetIndexToSourceIndices[targetIndex]?.push([sourceIndex, i])
    }
  }

  return {
    sourceIndexToTargetIndices,
    targetIndexToSourceIndices,
  }
}

export function calculateDegrees (
  pointsNumber: number | undefined,
  sourceIndexToTargetIndices: LinkAdjacencyList | undefined,
  targetIndexToSourceIndices: LinkAdjacencyList | undefined
): {
    degree: number[] | undefined;
    inDegree: number[] | undefined;
    outDegree: number[] | undefined;
  } {
  if (pointsNumber === undefined) {
    return {
      degree: undefined,
      inDegree: undefined,
      outDegree: undefined,
    }
  }

  const degree = new Array(pointsNumber).fill(0)
  const inDegree = new Array(pointsNumber).fill(0)
  const outDegree = new Array(pointsNumber).fill(0)

  for (let i = 0; i < pointsNumber; i++) {
    inDegree[i] = targetIndexToSourceIndices?.[i]?.length ?? 0
    outDegree[i] = sourceIndexToTargetIndices?.[i]?.length ?? 0
    degree[i] = (inDegree[i] ?? 0) + (outDegree[i] ?? 0)
  }

  return {
    degree,
    inDegree,
    outDegree,
  }
}
