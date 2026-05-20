import { type GraphConfigInterface } from '@/graph/config'
import { getRgbaColor } from '@/graph/helper'
import { FPSMonitor } from '@/graph/modules/FPSMonitor'
import { createTimerQueryPool } from '@/graph/perf'

import { type ConfigUpdateStateContext } from './config-update-state-context'

export function applyConfigUpdateStateEffects (
  prevConfig: GraphConfigInterface,
  context: ConfigUpdateStateContext
): void {
  const {
    config,
    graph,
    points,
    lines,
    store,
    device,
    canvas,
    fpsMonitor,
    timerQueryPool,
    zoomInstance,
    setFpsMonitor,
    setTimerQueryPool,
    markLinksChanged,
    markRenderDirty,
    resetAdaptiveDpr,
    maybeApplyAdaptiveDpr,
    applyEffectivePixelRatio,
    resizeCanvas,
    update,
    updateZoomDragBehaviors,
  } = context

  if (prevConfig.pointDefaultColor !== config.pointDefaultColor) {
    graph.updatePointColor()
    points?.updateColor()
  }
  if (prevConfig.pointDefaultSize !== config.pointDefaultSize) {
    graph.updatePointSize()
    points?.updateSize()
  }
  if (prevConfig.pointDefaultShape !== config.pointDefaultShape) {
    graph.updatePointShape()
    points?.updateShape()
  }
  if (prevConfig.linkDefaultColor !== config.linkDefaultColor) {
    graph.updateLinkColor()
    lines?.updateColor()
  }
  if (prevConfig.linkDefaultWidth !== config.linkDefaultWidth) {
    graph.updateLinkWidth()
    lines?.updateWidth()
  }
  if (prevConfig.linkDefaultArrows !== config.linkDefaultArrows) {
    graph.updateArrows()
    lines?.updateArrow()
  }
  if (prevConfig.curvedLinkSegments !== config.curvedLinkSegments ||
    prevConfig.curvedLinks !== config.curvedLinks ||
    prevConfig.curvedLinkWeight !== config.curvedLinkWeight ||
    prevConfig.curvedLinkControlPointDistance !== config.curvedLinkControlPointDistance ||
    prevConfig.linkBundlingStrength !== config.linkBundlingStrength ||
    prevConfig.linkBundlingCellSize !== config.linkBundlingCellSize) {
    lines?.updateCurveLineGeometry()
    markLinksChanged()
  }

  if (prevConfig.backgroundColor !== config.backgroundColor) {
    store.backgroundColor = getRgbaColor(config.backgroundColor)
  }
  if (prevConfig.hoveredPointRingColor !== config.hoveredPointRingColor) {
    store.setHoveredPointRingColor(config.hoveredPointRingColor)
  }
  if (prevConfig.focusedPointRingColor !== config.focusedPointRingColor) {
    store.setFocusedPointRingColor(config.focusedPointRingColor)
  }
  if (prevConfig.pointGreyoutColor !== config.pointGreyoutColor) {
    store.setGreyoutPointColor(config.pointGreyoutColor)
  }
  if (prevConfig.hoveredLinkColor !== config.hoveredLinkColor) {
    store.setHoveredLinkColor(config.hoveredLinkColor)
  }
  if (prevConfig.focusedPointIndex !== config.focusedPointIndex) {
    store.setFocusedPoint(config.focusedPointIndex)
  }
  if (prevConfig.outlinedPointRingColor !== config.outlinedPointRingColor) {
    store.setOutlinedPointRingColor(config.outlinedPointRingColor)
  }
  if (prevConfig.highlightedPointIndices !== config.highlightedPointIndices) {
    store.setHighlightedPointSet(config.highlightedPointIndices)
  }
  if (prevConfig.outlinedPointIndices !== config.outlinedPointIndices) {
    store.setOutlinedPointSet(config.outlinedPointIndices)
  }
  if (prevConfig.highlightedPointIndices !== config.highlightedPointIndices ||
      prevConfig.outlinedPointIndices !== config.outlinedPointIndices) {
    points?.updatePointStatus()
  }
  if (prevConfig.activePointIndices !== config.activePointIndices) {
    points?.markActivePointMaskDirty()
    markRenderDirty()
  }
  if (prevConfig.highlightedLinkIndices !== config.highlightedLinkIndices) {
    lines?.updateLinkStatus()
  }
  if (prevConfig.activeLinkIndices !== config.activeLinkIndices) {
    lines?.markActiveLinkMaskDirty()
    markRenderDirty()
  }
  if (prevConfig.pixelRatio !== config.pixelRatio ||
      prevConfig.adaptivePixelRatio !== config.adaptivePixelRatio) {
    if (config.adaptivePixelRatio) {
      resetAdaptiveDpr()
      maybeApplyAdaptiveDpr(performance.now())
    } else {
      applyEffectivePixelRatio(config.pixelRatio)
    }
  }
  if (prevConfig.spaceSize !== config.spaceSize) {
    store.adjustSpaceSize(config.spaceSize, device?.limits.maxTextureDimension2D ?? 4096)
    resizeCanvas(true)
    update(store.isSimulationRunning ? store.alpha : 0)
  }
  if (prevConfig.constrainCameraToGraph !== config.constrainCameraToGraph ||
      prevConfig.cameraBoundsPadding !== config.cameraBoundsPadding) {
    zoomInstance.updateTranslateExtent()
  }
  if (prevConfig.showFPSMonitor !== config.showFPSMonitor) {
    if (config.showFPSMonitor) {
      setFpsMonitor(new FPSMonitor(canvas))
    } else {
      fpsMonitor?.destroy()
      setFpsMonitor(undefined)
    }
  }
  if (prevConfig.enableGpuTimings !== config.enableGpuTimings) {
    if (config.enableGpuTimings && device) {
      setTimerQueryPool(createTimerQueryPool(device))
    } else {
      timerQueryPool?.destroy()
      setTimerQueryPool(undefined)
    }
  }
  if (prevConfig.enableZoom !== config.enableZoom || prevConfig.enableDrag !== config.enableDrag) {
    updateZoomDragBehaviors()
  }
  if (prevConfig.minZoomLevel !== config.minZoomLevel ||
      prevConfig.maxZoomLevel !== config.maxZoomLevel) {
    zoomInstance.updateScaleExtent()
  }

  if (prevConfig.onLinkClick !== config.onLinkClick ||
      prevConfig.onLinkContextMenu !== config.onLinkContextMenu ||
      prevConfig.onLinkMouseOver !== config.onLinkMouseOver ||
      prevConfig.onLinkMouseOut !== config.onLinkMouseOut) {
    store.updateLinkHoveringEnabled(config)
  }
}
