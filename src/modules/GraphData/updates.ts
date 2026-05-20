interface ClusterData {
  pointsNumber: number | undefined
  inputPointClusters: (number | undefined)[] | undefined
  inputClusterPositions: (number | undefined)[] | undefined
  inputClusterStrength: Float32Array | undefined
  pointClusters: (number | undefined)[] | undefined
  clusterPositions: (number | undefined)[] | undefined
  clusterStrength: Float32Array | undefined
}

export function resolveLinkStrength (
  inputLinkStrength: Float32Array | undefined,
  linksNumber: number | undefined
): Float32Array | undefined {
  if (linksNumber === undefined) return undefined
  if (inputLinkStrength === undefined || inputLinkStrength.length !== linksNumber) return undefined
  return inputLinkStrength
}

export function updateClusterData (graphData: ClusterData): void {
  if (graphData.pointsNumber === undefined) {
    graphData.pointClusters = undefined
    graphData.clusterPositions = undefined
    return
  }

  if (graphData.inputPointClusters === undefined || graphData.inputPointClusters.length !== graphData.pointsNumber) {
    graphData.pointClusters = undefined
  } else {
    graphData.pointClusters = graphData.inputPointClusters
  }

  if (graphData.inputClusterPositions === undefined) {
    graphData.clusterPositions = undefined
  } else {
    graphData.clusterPositions = graphData.inputClusterPositions
  }

  if (graphData.inputClusterStrength === undefined || graphData.inputClusterStrength.length !== graphData.pointsNumber) {
    graphData.clusterStrength = undefined
  } else {
    graphData.clusterStrength = graphData.inputClusterStrength
  }
}
