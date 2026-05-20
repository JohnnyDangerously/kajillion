interface GraphDataLifecycle {
  updatePoints: () => void
  updatePointColor: () => void
  updatePointSize: () => void
  updatePointShape: () => void
  updatePointImageIndices: () => void
  updatePointImageSizes: () => void
  updateLinks: () => void
  updateLinkColor: () => void
  updateLinkWidth: () => void
  updateArrows: () => void
  updateLinkStrength: () => void
  updateClusters: () => void
}

export function updateGraphData (graphData: GraphDataLifecycle): void {
  graphData.updatePoints()
  graphData.updatePointColor()
  graphData.updatePointSize()
  graphData.updatePointShape()
  graphData.updatePointImageIndices()
  graphData.updatePointImageSizes()

  graphData.updateLinks()
  graphData.updateLinkColor()
  graphData.updateLinkWidth()
  graphData.updateArrows()
  graphData.updateLinkStrength()

  graphData.updateClusters()
}
