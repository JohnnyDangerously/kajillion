import { createClusterTooltip } from './cluster-tooltip'
import type { NeonNetworkRuntime } from './runtime'

export function installInteractionHandlers (rt: NeonNetworkRuntime): void {
  rt.tooltipHandle = createClusterTooltip()
  const prevHover = rt.ctx.graph.config.onPointMouseOver
  const prevLeave = rt.ctx.graph.config.onPointMouseOut
  rt.ctx.graph.setConfigPartial({
    onPointMouseOver: (pointIndex: number) => {
      prevHover?.(pointIndex)
      rt.lastHoveredIdx = pointIndex
      if (!rt.tooltipHandle || rt.viewStack.length > 0) return
      const idx = rt.currentClusterIndex
      if (!idx) return
      const key = idx.byNode[pointIndex]
      if (!key) return
      const info = idx.byKey.get(key)
      if (!info || !info.centroid) return
      const [sx, sy] = rt.ctx.graph.spaceToScreenPosition([info.centroid.x, info.centroid.y])
      rt.tooltipHandle.show(sx, sy, `${info.value} · ${info.count}`, idx.fieldLabel)
    },
    onPointMouseOut: () => {
      prevLeave?.()
      rt.lastHoveredIdx = -1
      rt.tooltipHandle?.hide()
    },
    onDragStart: () => {
      if (rt.viewStack.length === 0) return
      const top = rt.viewStack[rt.viewStack.length - 1]
      if (top?.kind !== 'portrait') return
      if (rt.lastHoveredIdx < 0) return
      if (!top.members.includes(rt.lastHoveredIdx)) return
      rt.draggingIdx = rt.lastHoveredIdx
      if (rt.currentPortraitAnchored) rt.currentPortraitAnchored[rt.draggingIdx] = 1
    },
    onDrag: (e) => {
      if (rt.draggingIdx < 0) return
      const [wx, wy] = rt.ctx.graph.screenToSpacePosition([e.x as number, e.y as number])
      rt.dragOverrideX = wx
      rt.dragOverrideY = wy
    },
    onDragEnd: () => {
      if (rt.draggingIdx < 0) return
      const top = rt.viewStack[rt.viewStack.length - 1]
      if (top?.kind === 'portrait' && rt.currentPortraitAnchored) {
        rt.currentPortraitAnchored[rt.draggingIdx] = 0
      }
      rt.draggingIdx = -1
      rt.dragOverrideX = NaN
      rt.dragOverrideY = NaN
    },
  })
}
