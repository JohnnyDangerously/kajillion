import type { GraphConfigInterface } from '@/graph/config'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Store } from '@/graph/modules/Store'
import type { WebGpuLinkPickerGrid } from '../runtime-contracts'
import { clearHoveredLink, updateHoveredLinkIndex } from './state'
import { distanceToLinkHoverPathScreenSquared } from './link-path'
import type { HoverChange, LinkHoverPathCache, TransformLike } from './types'

export interface CpuLinkHoverInput {
  cache: LinkHoverPathCache;
  config: GraphConfigInterface;
  graph: GraphData;
  grid: WebGpuLinkPickerGrid | undefined;
  links: Float32Array | undefined;
  linksNumber: number;
  positions: Float32Array | undefined;
  store: Store;
  transform: TransformLike;
}

export function findHoveredLinkOnCpu (input: CpuLinkHoverInput): HoverChange {
  const { cache, config, graph, grid, links, linksNumber, positions, store, transform } = input
  if (store.hoveredPoint) return clearHoveredLink(store)
  if (!positions || !links || linksNumber === 0 || !grid) return clearHoveredLink(store)

  const mouseX = store.mousePosition[0] ?? NaN
  const mouseY = store.mousePosition[1] ?? NaN
  if (!Number.isFinite(mouseX) || !Number.isFinite(mouseY)) return clearHoveredLink(store)

  const screenMouseX = store.screenMousePosition[0] ?? 0
  const screenMouseY = store.screenSize[1] - (store.screenMousePosition[1] ?? store.screenSize[1])
  const k = Math.max(0.001, transform.k)
  const maxPickRadiusPx = (
    store.maxPointSize * 2 +
    5 +
    config.hoveredLinkWidthIncrease +
    config.focusedLinkWidthIncrease +
    0.5
  ) / 2
  const radiusSpace = Math.max(grid.cellSize, (Math.max(4, maxPickRadiusPx) / k) * 2)
  const minCx = Math.max(0, Math.floor((mouseX - radiusSpace) / grid.cellSize))
  const maxCx = Math.min(grid.columns - 1, Math.floor((mouseX + radiusSpace) / grid.cellSize))
  const minCy = Math.max(0, Math.floor((mouseY - radiusSpace) / grid.cellSize))
  const maxCy = Math.min(grid.rows - 1, Math.floor((mouseY + radiusSpace) / grid.cellSize))
  const screenWidth = store.screenSize[0] ?? 0
  const screenHeight = store.screenSize[1] ?? 0
  const spaceSize = store.adjustedSpaceSize
  const offsetX = (screenWidth - spaceSize) / 2
  const offsetY = (screenHeight - spaceSize) / 2
  const linkWidths = graph.linkWidths
  const linkArrows = graph.linkArrows
  const widthScale = config.linkWidthScale
  const zoomWidthScale = config.scaleLinksOnZoom ? k : Math.min(5.0, Math.max(1.0, k * 0.01))
  let bestIndex = -1
  let bestDistanceSq = Infinity

  let visitToken = grid.visitToken + 1
  if (visitToken > 0xffff_fffe) {
    grid.visitMarks.fill(0)
    visitToken = 1
  }
  grid.visitToken = visitToken

  for (let cy = minCy; cy <= maxCy; cy += 1) {
    for (let cx = minCx; cx <= maxCx; cx += 1) {
      const cell = cy * grid.columns + cx
      const start = grid.cellOffsets[cell] ?? 0
      const end = grid.cellOffsets[cell + 1] ?? start
      for (let entryIndex = start; entryIndex < end; entryIndex += 1) {
        const i = grid.cellEntries[entryIndex] ?? -1
        if (i < 0 || i >= linksNumber || grid.visitMarks[i] === visitToken) continue
        grid.visitMarks[i] = visitToken
        const source = links[i * 2]
        const target = links[i * 2 + 1]
        if (source === undefined || target === undefined) continue
        const sx = positions[source * 2]
        const sy = positions[source * 2 + 1]
        const tx = positions[target * 2]
        const ty = positions[target * 2 + 1]
        if (sx === undefined || sy === undefined || tx === undefined || ty === undefined) continue
        const dxWorld = tx - sx
        const dyWorld = ty - sy
        const worldDistance = Math.sqrt(dxWorld * dxWorld + dyWorld * dyWorld)
        if (config.linkMinPixelLength > 0 && worldDistance * k < config.linkMinPixelLength) continue
        const distanceSq = distanceToLinkHoverPathScreenSquared(
          config,
          cache,
          screenMouseX,
          screenMouseY,
          sx,
          sy,
          tx,
          ty,
          i,
          transform.x,
          transform.y,
          k,
          offsetX,
          offsetY,
          spaceSize
        )
        const hasArrow = (linkArrows?.[i] ?? +config.linkDefaultArrows) > 0.5
        const rawWidth = (linkWidths?.[i] ?? config.linkDefaultWidth) * widthScale
        const arrowWidth = hasArrow ? rawWidth * 2 * config.linkArrowsSizeScale : rawWidth
        const cap = hasArrow ? store.maxPointSize * 2 : store.maxPointSize
        let widthPx = Math.min(Math.max(rawWidth, arrowWidth) * zoomWidthScale, cap)
        widthPx += 5 + 0.5
        if (store.hoveredLinkIndex === i) widthPx += config.hoveredLinkWidthIncrease
        if (config.focusedLinkIndex === i) widthPx += config.focusedLinkWidthIncrease
        const threshold = widthPx / 2
        if (distanceSq <= threshold * threshold && distanceSq < bestDistanceSq) {
          bestDistanceSq = distanceSq
          bestIndex = i
        }
      }
    }
  }

  return updateHoveredLinkIndex(store, bestIndex)
}
