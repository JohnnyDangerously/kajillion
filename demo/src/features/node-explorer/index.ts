import { createExplorerBar } from './explorer-bar'
import { createFacetBar } from './facet-bar'
import { indicesForSelection } from './facet-engine'
import { createFocusZoom } from './focus-zoom'
import { createHighlightHandle } from './highlight-policy'
import { createProfilePanel } from './profile-panel'
import { runSkitter } from './skitter-animation'
import type { ExplorerHandle, ExplorerMountOptions } from './types'

export type {
  ExplorerNetwork,
  ExplorerFacets,
  ExplorerMountOptions,
  ExplorerHandle,
} from './types'

export function mountNodeExplorer (opts: ExplorerMountOptions): ExplorerHandle {
  const { graph, network, facets, onExitFocus, onNodeClicked, onExplore } = opts

  const liveAtMount = graph.getPointPositions()
  const basePositions = new Float32Array(liveAtMount.length)
  for (let i = 0; i < liveAtMount.length; i += 1) basePositions[i] = liveAtMount[i] as number

  const profile = createProfilePanel(network, facets, onExplore)
  const highlight = createHighlightHandle(graph)
  const zoom = createFocusZoom({ graph })
  let skitter: ReturnType<typeof runSkitter> | null = null
  let activeButtonId: string | null = null

  const stopSkitter = (): void => {
    if (skitter) {
      skitter.restore(420)
      skitter = null
    }
  }

  const prevClick = graph.config.onPointClick
  graph.setConfigPartial({
    onPointClick: (pointIndex: number): void => {
      profile.show(pointIndex)
      onNodeClicked?.(pointIndex)
      prevClick?.(pointIndex)
    },
    onBackgroundClick: (): void => {
      profile.hide()
    },
  })

  const hop1Indices = (): number[] => {
    if (!network.hops) return []
    const out: number[] = []
    for (let i = 0; i < network.nodeCount; i += 1) {
      if (network.hops[i] === 1) out.push(i)
    }
    return out
  }
  const randomSubset = (k: number): number[] => {
    const target = Math.min(k, network.nodeCount)
    const seen = new Set<number>()
    while (seen.size < target) {
      seen.add(Math.floor(Math.random() * network.nodeCount))
    }
    return [...seen]
  }

  const bar = createExplorerBar([
    {
      id: 'fit',
      label: 'Fit view',
      onClick: () => {
        stopSkitter()
        highlight.clear()
        zoom.fitView()
        activeButtonId = 'fit'
        bar.setActive(activeButtonId)
      },
    },
    {
      id: 'work',
      label: 'Work zoom',
      onClick: () => {
        stopSkitter()
        zoom.workZoom()
        activeButtonId = 'work'
        bar.setActive(activeButtonId)
      },
    },
    {
      id: 'hop1',
      label: 'Hop-1 only',
      onClick: () => {
        stopSkitter()
        highlight.set(hop1Indices())
        activeButtonId = 'hop1'
        bar.setActive(activeButtonId)
      },
    },
    {
      id: 'skitter',
      label: 'Skitter 100',
      onClick: () => {
        stopSkitter()
        const subset = randomSubset(100)
        highlight.clear()
        skitter = runSkitter({ graph, basePositions, indices: subset, durationMs: 700 })
        activeButtonId = 'skitter'
        bar.setActive(activeButtonId)
      },
    },
    {
      id: 'clear',
      label: 'Clear',
      onClick: () => {
        stopSkitter()
        highlight.clear()
        profile.hide()
        if (facetBar) facetBar.selection.clear()
        activeButtonId = null
        bar.setActive(activeButtonId)
      },
    },
  ])

  const facetBar = facets
    ? createFacetBar({
      facets,
      onChange: (selection) => {
        stopSkitter()
        if (selection.size === 0) {
          highlight.clear()
          activeButtonId = null
          bar.setActive(null)
          return
        }
        const indices = indicesForSelection(facets, network.nodeCount, selection)
        highlight.set(indices)
        activeButtonId = null
        bar.setActive(null)
      },
    })
    : null

  const focusEscListener = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && onExitFocus) onExitFocus()
  }
  if (onExitFocus) document.addEventListener('keydown', focusEscListener)

  return {
    dispose (): void {
      stopSkitter()
      highlight.clear()
      profile.dispose()
      bar.dispose()
      facetBar?.dispose()
      if (onExitFocus) document.removeEventListener('keydown', focusEscListener)
      graph.setConfigPartial({
        onPointClick: prevClick,
        onBackgroundClick: undefined,
      })
    },
  }
}
