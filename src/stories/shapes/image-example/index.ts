import { Graph } from '@kajillion/graph'
import { createXcodeDependencyGraphData } from './dependency-data'
import { loadPngImages } from './image-loading'

import boxUrl from './icons/box.png'
import toolboxUrl from './icons/toolbox.png'
import swiftUrl from './icons/swift.png'
import legoUrl from './icons/lego.png'
import sUrl from './icons/s.png'

export const imageExample = (): {div: HTMLDivElement; graph: Graph; destroy?: () => void } => {
  // Create container div
  const div = document.createElement('div')
  div.style.height = '100vh'
  div.style.width = '100%'
  div.style.display = 'flex'
  div.style.flexDirection = 'column'

  // Create main graph container
  const graphContainer = document.createElement('div')
  graphContainer.style.height = '100vh'
  graphContainer.style.width = '100%'
  graphContainer.style.position = 'absolute'
  graphContainer.style.overflow = 'hidden'
  div.appendChild(graphContainer)

  try {
    const spaceSize = 4096
    const {
      pointPositions,
      pointColors,
      pointShapes,
      pointSizes,
      imageIndices,
      links,
      linkArrows,
      linkColors,
    } = createXcodeDependencyGraphData()

    // Create graph with static positioning
    const graph = new Graph(graphContainer, {
      spaceSize,
      enableSimulation: false,
      enableDrag: false,
      linkDefaultArrows: true,
      curvedLinks: true,
      pointDefaultSize: 50,
      linkDefaultWidth: 3,
      hoveredPointRingColor: 'white',
      renderHoveredPointRing: true,

      // Add click handler for point highlighting
      onPointClick: (pointIndex: number): void => {
        const neighboringPoints = graph.getNeighboringPointIndices(pointIndex)
        const highlightedPointIndices = [pointIndex, ...neighboringPoints]
        const highlightedLinkIndices = graph.getConnectedLinkIndices(highlightedPointIndices)
        graph.setConfigPartial({ highlightedPointIndices, highlightedLinkIndices })
      },
      onBackgroundClick: (): void => {
        graph.setConfigPartial({
          highlightedPointIndices: undefined,
          highlightedLinkIndices: undefined,
        })
      },
    })

    // Guard flag to prevent async callbacks from executing after destruction
    let isDestroyed = false

    // Load images asynchronously and set them when ready
    loadPngImages([swiftUrl, boxUrl, toolboxUrl, legoUrl, sUrl]).then((imageDataArray) => {
      // Check if graph has been destroyed before calling any methods
      if (isDestroyed) {
        return
      }
      // Set images and their indices
      graph.setImageData(imageDataArray)
      graph.setPointImageIndices(imageIndices)
      graph.render()
    }).catch((error) => {
      // Only log error if graph hasn't been destroyed
      if (!isDestroyed) {
        console.error('Error loading images:', error)
      }
    })

    // Set all data
    graph.setPointPositions(pointPositions)
    graph.setPointColors(pointColors)
    graph.setPointShapes(pointShapes)
    graph.setPointSizes(pointSizes)

    // Set links if we have any dependencies
    if (links.length > 0) {
      graph.setLinks(new Float32Array(links))
      graph.setLinkArrows(linkArrows)
      graph.setLinkColors(new Float32Array(linkColors))
    }

    graph.render()

    const destroy = (): void => {
      isDestroyed = true
      graph.destroy()
    }

    return { div, graph, destroy }
  } catch (error) {
    console.error('Error creating Xcode dependency graph:', error)
    div.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #ff0000; font-size: 18px;">
        Error loading Xcode dependency graph: ${error instanceof Error ? error.message : 'Unknown error'}
      </div>
    `
    throw error
  }
}
