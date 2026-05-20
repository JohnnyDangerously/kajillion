import { Graph, type GraphConfig } from '@kajillion/graph'
import { generateData } from './data-gen'
import { attachDemoActions } from './demo-actions'
import './style.css'

export const actions = (): { graph: Graph; div: HTMLDivElement; destroy?: () => void } => {
  const div = document.createElement('div')
  div.className = 'app'

  const graphDiv = document.createElement('div')
  graphDiv.className = 'graph'
  div.appendChild(graphDiv)

  const actionsDiv = document.createElement('div')
  actionsDiv.className = 'actions'
  div.appendChild(actionsDiv)

  const actionsHeader = document.createElement('div')
  actionsHeader.className = 'actions-header'
  actionsHeader.textContent = 'Actions'
  actionsDiv.appendChild(actionsHeader)

  const defaultLinkColor = '#5F74C2'
  const highlightLinkColor = '#7080D0'

  const config: GraphConfig = {
    spaceSize: 4096,
    backgroundColor: '#2d313a',
    pointDefaultSize: 4,
    pointDefaultColor: '#4B5BBF',
    linkDefaultWidth: 0.6,
    scalePointsOnZoom: true,
    linkDefaultColor: defaultLinkColor,
    linkDefaultArrows: false,
    linkGreyoutOpacity: 0,
    curvedLinks: true,
    renderHoveredPointRing: true,
    hoveredPointRingColor: '#4B5BBF',
    enableDrag: true,
    simulationLinkDistance: 1,
    simulationLinkSpring: 2,
    simulationRepulsion: 0.2,
    simulationGravity: 0.1,
    simulationDecay: 100000,
    onPointClick: (index: number): void => {
      graph.setConfigPartial({
        highlightedPointIndices: [index],
        outlinedPointIndices: [index],
        highlightedLinkIndices: [],
        linkDefaultColor: defaultLinkColor,
      })
      graph.zoomToPointByIndex(index)
      console.log('Clicked point index: ', index)
    },
    onBackgroundClick: (): void => {
      graph.setConfigPartial({
        highlightedPointIndices: undefined,
        outlinedPointIndices: undefined,
        highlightedLinkIndices: undefined,
        linkDefaultColor: defaultLinkColor,
      })
      console.log('Clicked background')
    },
    attribution: 'visualized with <a href="https://cosmograph.app/" style="color: var(--cosmosgl-attribution-color);" target="_blank">Cosmograph</a>',
  }

  const graph = new Graph(graphDiv, config)

  const { pointPositions, links } = generateData()
  graph.setPointPositions(pointPositions)
  graph.setLinks(links)

  graph.zoom(0.9)
  graph.render()

  attachDemoActions({
    actionsDiv,
    config,
    defaultLinkColor,
    div,
    graph,
    highlightLinkColor,
    pointPositions,
  })

  const destroy = (): void => {
    graph.destroy()
  }

  return { div, graph, destroy }
}
