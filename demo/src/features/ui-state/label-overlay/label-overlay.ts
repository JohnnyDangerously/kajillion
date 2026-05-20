import type { Graph } from '@kajillion/graph'

import { isWorkMode } from '../../control-plane/controls'
import type { DemoConfig } from '../../control-plane/types'
import type { LabelAnchor } from './label-anchors'

export interface LabelOverlayController {
  setAnchors: (anchors: LabelAnchor[]) => void;
  clearAnchors: () => void;
  start: () => void;
}

export function createLabelOverlayController (options: {
  graphHost: HTMLDivElement;
  labelContainer: HTMLElement | null;
  initialLabels: HTMLDivElement[];
  workRegionsEl: HTMLDivElement | null;
  getConfig: () => DemoConfig;
  getGraph: () => Graph | null;
}): LabelOverlayController {
  const labels = [...options.initialLabels]
  let anchors: LabelAnchor[] = []
  let animationFrame = 0

  function ensureLabelElements (count: number): HTMLDivElement[] {
    while (labels.length < count && options.labelContainer) {
      const el = document.createElement('div')
      el.className = 'cluster-label'
      options.labelContainer.appendChild(el)
      labels.push(el)
    }
    return labels
  }

  function updateWorkRegions (): void {
    if (!options.workRegionsEl?.childElementCount) return
    options.workRegionsEl.innerHTML = ''
  }

  function update (graph: Graph): void {
    updateWorkRegions()
    const currentConfig = options.getConfig()
    const hostRect = options.graphHost.getBoundingClientRect()
    const labelElements = ensureLabelElements(anchors.length)
    for (const [i, el] of labelElements.entries()) {
      const anchor = anchors[i]
      if (!el) continue
      if (!anchor) {
        el.style.opacity = '0'
        continue
      }
      if (el.textContent !== anchor.label) el.textContent = anchor.label
      const [x, y] = graph.spaceToScreenPosition([anchor.x, anchor.y])
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`
      const isVisible = x > -120 && x < hostRect.width + 120 && y > -80 && y < hostRect.height + 80
      const zoom = (graph as unknown as { getZoomLevel?: () => number }).getZoomLevel?.() ?? 1
      const zoomFade = isWorkMode(currentConfig)
        ? Math.max(0.18, Math.min(1, (4.4 - zoom) / 2.8))
        : Math.max(0, Math.min(1, (1.65 - zoom) / 1.1))
      const labelOpacity = isWorkMode(currentConfig)
        ? (currentConfig.theme === 'light' ? 0.88 : 0.78)
        : currentConfig.palette === 'influence'
          ? 0.96
          : currentConfig.palette === 'talent'
            ? 0.88
            : currentConfig.palette === 'fintech'
              ? 0.92
              : (currentConfig.theme === 'light' ? 0.72 : 0.54)
      el.style.opacity = isVisible ? (labelOpacity * zoomFade).toFixed(2) : '0'
    }
  }

  return {
    setAnchors: (nextAnchors) => {
      anchors = nextAnchors
    },
    clearAnchors: () => {
      anchors = []
    },
    start: () => {
      if (animationFrame !== 0) return
      const loop = (): void => {
        const graph = options.getGraph()
        if (graph) update(graph)
        animationFrame = requestAnimationFrame(loop)
      }
      animationFrame = requestAnimationFrame(loop)
    },
  }
}
