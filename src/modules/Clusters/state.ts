import type { ClusterTextureState } from './contracts'

export function getClusterCount (pointClusters: (number | undefined)[] | undefined): number {
  return (pointClusters ?? []).reduce<number>((max, clusterIndex) => {
    if (clusterIndex === undefined || clusterIndex < 0) return max
    return Math.max(max, clusterIndex)
  }, 0) + 1
}

export function getClustersTextureSize (clusterCount: number): number {
  return Math.ceil(Math.sqrt(clusterCount))
}

export function createClusterTextureState (options: {
  pointsTextureSize: number;
  clustersTextureSize: number;
  clusterCount: number;
  pointsNumber: number;
  pointClusters: (number | undefined)[] | undefined;
  clusterPositions: (number | undefined)[] | undefined;
  clusterStrength: Float32Array | undefined;
}): ClusterTextureState {
  const pointsTextureDataSize = options.pointsTextureSize * options.pointsTextureSize * 4
  const clustersTextureDataSize = options.clustersTextureSize * options.clustersTextureSize * 4

  const clusterState = new Float32Array(pointsTextureDataSize)
  const clusterPositions = new Float32Array(clustersTextureDataSize).fill(-1)
  const clusterForceCoefficient = new Float32Array(pointsTextureDataSize).fill(1)

  if (options.clusterPositions) {
    for (let cluster = 0; cluster < options.clusterCount; ++cluster) {
      clusterPositions[cluster * 4 + 0] = options.clusterPositions[cluster * 2 + 0] ?? -1
      clusterPositions[cluster * 4 + 1] = options.clusterPositions[cluster * 2 + 1] ?? -1
    }
  }

  for (let i = 0; i < options.pointsNumber; ++i) {
    const clusterIndex = options.pointClusters?.[i]
    if (clusterIndex === undefined) {
      clusterState[i * 4 + 0] = -1
      clusterState[i * 4 + 1] = -1
    } else {
      clusterState[i * 4 + 0] = clusterIndex % options.clustersTextureSize
      clusterState[i * 4 + 1] = Math.floor(clusterIndex / options.clustersTextureSize)
    }

    if (options.clusterStrength) clusterForceCoefficient[i * 4 + 0] = options.clusterStrength[i] ?? 1
  }

  return {
    clusterState,
    clusterPositions,
    clusterForceCoefficient,
  }
}
