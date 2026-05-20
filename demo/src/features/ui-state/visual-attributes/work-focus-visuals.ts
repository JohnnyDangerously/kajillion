import type { DemoConfig } from '../../control-plane/types'
import type { GeneratedGraph } from '../../../generate-graph'
import type { RenderableGraphData } from '../../../graph-contract'
import type { WorkFocusState } from '../work-focus-panel'

export function applyWorkFocusVisuals (
  data: GeneratedGraph | RenderableGraphData,
  config: DemoConfig,
  workFocusState: WorkFocusState,
  pointColors: Float32Array,
  pointSizes: Float32Array,
  linkColors: Float32Array,
  linkWidths: Float32Array
): void {
  const isLight = config.theme === 'light'
  if (workFocusState.type === 'point') {
    const focusSet = new Set([workFocusState.index])
    const neighborSet = new Set(workFocusState.neighbors)
    const secondSet = new Set(workFocusState.secondDegree)
    for (let i = 0; i < data.nodeCount; i += 1) {
      const alphaOffset = i * 4 + 3
      const currentAlpha = pointColors[alphaOffset] ?? 1
      if (focusSet.has(i)) {
        pointSizes[i] = Math.max(pointSizes[i] ?? 0, 34)
        pointColors[alphaOffset] = 1
      } else if (neighborSet.has(i)) {
        pointSizes[i] = Math.max(pointSizes[i] ?? 0, isLight ? 15.5 : 14.5)
        pointColors[alphaOffset] = Math.max(currentAlpha, isLight ? 0.92 : 0.96)
      } else if (secondSet.has(i)) {
        pointSizes[i] = Math.max(pointSizes[i] ?? 0, isLight ? 8.2 : 7.6)
        pointColors[alphaOffset] = Math.max(currentAlpha * 0.72, isLight ? 0.46 : 0.42)
      } else {
        pointColors[alphaOffset] = Math.min(currentAlpha, isLight ? 0.20 : 0.24)
      }
    }

    const directLinks = new Set(workFocusState.directLinks)
    const contextLinks = new Set(workFocusState.connectedLinks)
    for (let i = 0; i < data.edgeCount; i += 1) {
      const alphaOffset = i * 4 + 3
      const currentAlpha = linkColors[alphaOffset] ?? 1
      if (directLinks.has(i)) {
        linkWidths[i] = Math.max(linkWidths[i] ?? 0, 3.6)
        linkColors[alphaOffset] = Math.max(currentAlpha, isLight ? 0.70 : 0.80)
      } else if (contextLinks.has(i)) {
        linkWidths[i] = Math.max(linkWidths[i] ?? 0, 1.85)
        linkColors[alphaOffset] = Math.max(currentAlpha, isLight ? 0.30 : 0.36)
      } else {
        linkColors[alphaOffset] = Math.min(currentAlpha, isLight ? 0.06 : 0.08)
      }
    }
    return
  }

  if (workFocusState.type === 'link') {
    const endpoints = new Set(workFocusState.endpoints)
    for (let i = 0; i < data.nodeCount; i += 1) {
      const alphaOffset = i * 4 + 3
      const currentAlpha = pointColors[alphaOffset] ?? 1
      if (endpoints.has(i)) {
        pointSizes[i] = Math.max(pointSizes[i] ?? 0, 18)
        pointColors[alphaOffset] = 1
      } else {
        pointColors[alphaOffset] = Math.min(currentAlpha, isLight ? 0.18 : 0.22)
      }
    }
    linkWidths[workFocusState.index] = Math.max(linkWidths[workFocusState.index] ?? 0, 4.8)
    linkColors[workFocusState.index * 4 + 3] = 1
  }
}
