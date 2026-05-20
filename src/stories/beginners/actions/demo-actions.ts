import { type Graph, type GraphConfig } from '@kajillion/graph'

interface DemoActionsOptions {
  actionsDiv: HTMLDivElement
  config: GraphConfig
  defaultLinkColor: string
  div: HTMLDivElement
  graph: Graph
  highlightLinkColor: string
  pointPositions: { length: number }
}

export function attachDemoActions ({
  actionsDiv,
  config,
  defaultLinkColor,
  div,
  graph,
  highlightLinkColor,
  pointPositions,
}: DemoActionsOptions): void {
  let isPaused = false
  const pauseButton = document.createElement('div')
  pauseButton.className = 'action'
  pauseButton.textContent = 'Pause'
  actionsDiv.appendChild(pauseButton)

  function pause (): void {
    isPaused = true
    pauseButton.textContent = 'Start'
    graph.pause()
  }

  function unpause (): void {
    isPaused = false
    pauseButton.textContent = 'Pause'
    // if the graph is at 100% progress, start the graph
    if (graph.progress === 1) {
      graph.start()
    } else {
      graph.unpause()
    }
  }

  function togglePause (): void {
    if (isPaused) unpause()
    else pause()
  }

  pauseButton.addEventListener('click', togglePause)
  graph.setConfig({
    ...config,
    onSimulationEnd: (): void => {
      pause()
    },
  })

  function getRandomPointIndex (): number {
    return Math.floor((Math.random() * pointPositions.length) / 2)
  }

  function getRandomInRange ([min, max]: [number, number]): number {
    return Math.random() * (max - min) + min
  }

  function fitView (): void {
    graph.fitView()
  }

  function zoomIn (): void {
    const pointIndex = getRandomPointIndex()
    graph.zoomToPointByIndex(pointIndex)
    graph.setConfigPartial({
      highlightedPointIndices: [pointIndex],
      highlightedLinkIndices: [],
      linkDefaultColor: defaultLinkColor,
    })
    pause()
  }

  function highlightPoint (): void {
    const pointIndex = getRandomPointIndex()
    graph.setConfigPartial({
      highlightedPointIndices: [pointIndex],
      highlightedLinkIndices: [],
      linkDefaultColor: defaultLinkColor,
    })
    graph.fitView()
    pause()
  }

  function highlightPointsInArea (): void {
    const w = div.clientWidth
    const h = div.clientHeight
    const left = getRandomInRange([w / 4, w / 2])
    const right = getRandomInRange([left, (w * 3) / 4])
    const top = getRandomInRange([h / 4, h / 2])
    const bottom = getRandomInRange([top, (h * 3) / 4])
    pause()
    const indices = graph.findPointsInRect([
      [left, top],
      [right, bottom],
    ])
    const highlightedLinkIndices = graph.getConnectedLinkIndices(indices)
    graph.setConfigPartial({
      highlightedPointIndices: indices,
      highlightedLinkIndices,
      linkDefaultColor: highlightLinkColor,
    })
  }

  const fitViewButton = document.createElement('div')
  fitViewButton.className = 'action'
  fitViewButton.textContent = 'Fit View'
  fitViewButton.addEventListener('click', fitView)
  actionsDiv.appendChild(fitViewButton)

  const zoomButton = document.createElement('div')
  zoomButton.className = 'action'
  zoomButton.textContent = 'Zoom to a point'
  zoomButton.addEventListener('click', zoomIn)
  actionsDiv.appendChild(zoomButton)

  const highlightPointButton = document.createElement('div')
  highlightPointButton.className = 'action'
  highlightPointButton.textContent = 'Highlight a point'
  highlightPointButton.addEventListener('click', highlightPoint)
  actionsDiv.appendChild(highlightPointButton)

  const highlightPointsInAreaButton = document.createElement('div')
  highlightPointsInAreaButton.className = 'action'
  highlightPointsInAreaButton.textContent = 'Highlight points in a rectangular area'
  highlightPointsInAreaButton.addEventListener('click', highlightPointsInArea)
  actionsDiv.appendChild(highlightPointsInAreaButton)
}
