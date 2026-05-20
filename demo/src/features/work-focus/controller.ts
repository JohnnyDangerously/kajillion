import { isWorkMode, WORK_MODE_CAMERA, WORK_MODE_INTERACTION } from '../work-mode/profile'
import type { WorkFocusState } from '../ui-state/work-focus-panel'
import {
  buildWorkLinkFocusState,
  buildWorkPointFocusState,
  sampleIndices,
} from '../ui-state/graph-interactions'
import {
  baseOutlinedPointIndices,
  type WorkFocusController,
  type WorkFocusControllerOptions,
} from './contracts'
import { createFitPointIndices } from './fitting'
import { updateWorkFocusPanel } from './panel'
import { isCloseWorkZoom, type WorkPreviewState } from './preview'

export function createWorkFocusController (options: WorkFocusControllerOptions): WorkFocusController {
  let workFocusState: WorkFocusState | undefined
  let workPreviewState: WorkPreviewState | undefined

  const fitPointIndices = createFitPointIndices(options)

  const controller: WorkFocusController = {
    getFocusState: () => workFocusState,

    reset: () => {
      workFocusState = undefined
      workPreviewState = undefined
    },

    updatePanel: () => updateWorkFocusPanel(options, workFocusState),

    clearPreview: () => {
      const graph = options.getCurrentGraph()
      if (!graph || workFocusState || !workPreviewState) return
      workPreviewState = undefined
      graph.setConfigPartial({
        outlinedPointIndices: baseOutlinedPointIndices(options.getCurrentData() ?? options.getCurrentRenderData()),
        highlightedLinkIndices: undefined,
      })
      graph.render()
    },

    previewPoint: (index: number) => {
      const graph = options.getCurrentGraph()
      const cfg = options.getCurrentConfig()
      if (!graph || workFocusState || !isWorkMode(cfg)) return
      const previewType = isCloseWorkZoom(options) ? 'point-close' : 'point-far'
      if (workPreviewState?.type === previewType && workPreviewState.index === index) return
      workPreviewState = { type: previewType, index }
      if (previewType === 'point-far') {
        graph.setConfigPartial({
          outlinedPointIndices: [index],
          highlightedLinkIndices: undefined,
          linkGreyoutOpacity: options.buildGraphConfig(cfg).linkGreyoutOpacity,
        })
        graph.render()
        return
      }
      const neighbors = graph.getNeighboringPointIndices(index)
      const neighborhood = [index, ...neighbors]
      graph.setConfigPartial({
        outlinedPointIndices: [index],
        highlightedLinkIndices: graph.getConnectedLinkIndices(neighborhood),
        linkGreyoutOpacity: cfg.theme === 'light' ? 0.18 : 0.22,
      })
      graph.render()
    },

    previewLink: (index: number) => {
      const graph = options.getCurrentGraph()
      const cfg = options.getCurrentConfig()
      if (!graph || workFocusState || !isWorkMode(cfg) || !isCloseWorkZoom(options)) return
      if (workPreviewState?.type === 'link' && workPreviewState.index === index) return
      workPreviewState = { type: 'link', index }
      graph.setConfigPartial({
        outlinedPointIndices: graph.getConnectedPointIndices(index),
        highlightedLinkIndices: [index],
        linkGreyoutOpacity: cfg.theme === 'light' ? 0.18 : 0.22,
      })
      graph.render()
    },

    clearFocus: (fitOverview: boolean) => {
      const graph = options.getCurrentGraph()
      workFocusState = undefined
      workPreviewState = undefined
      controller.updatePanel()
      if (!graph) return
      const cfg = options.getCurrentConfig()
      const graphConfig = options.buildGraphConfig(cfg)
      graph.setConfigPartial({
        focusedPointIndex: undefined,
        focusedLinkIndex: undefined,
        highlightedPointIndices: undefined,
        highlightedLinkIndices: undefined,
        outlinedPointIndices: undefined,
        renderLodMode: graphConfig.renderLodMode,
        pointGreyoutOpacity: graphConfig.pointGreyoutOpacity,
        linkGreyoutOpacity: graphConfig.linkGreyoutOpacity,
      })
      const data = options.getCurrentData()
      if (data) options.applyCurrentVisualAttributes(graph, data)
      if (fitOverview && isWorkMode(cfg)) fitPointIndices([], WORK_MODE_CAMERA.overviewFitDurationMs, WORK_MODE_CAMERA.overviewFitPadding)
      graph.render()
    },

    focusPoint: (index: number, shouldZoom: boolean) => {
      const graph = options.getCurrentGraph()
      const data = options.getCurrentRenderData() ?? options.getCurrentData()
      const cfg = options.getCurrentConfig()
      if (!graph || !data || !isWorkMode(cfg)) return
      if (workFocusState?.type === 'point' && workFocusState.index === index) {
        if (shouldZoom) fitPointIndices(sampleIndices(workFocusState.visiblePoints, 96), 460, 0.34)
        return
      }
      workFocusState = buildWorkPointFocusState(graph, data, index)
      workPreviewState = undefined
      controller.updatePanel()
      graph.setConfigPartial({
        focusedPointIndex: index,
        focusedLinkIndex: undefined,
        highlightedPointIndices: workFocusState.visiblePoints,
        highlightedLinkIndices: workFocusState.connectedLinks,
        outlinedPointIndices: undefined,
        renderLodMode: 'exact',
        pointGreyoutOpacity: cfg.theme === 'light' ? WORK_MODE_INTERACTION.focusPointGreyoutLight : WORK_MODE_INTERACTION.focusPointGreyoutDark,
        linkGreyoutOpacity: cfg.theme === 'light' ? WORK_MODE_INTERACTION.focusLinkGreyoutLight : WORK_MODE_INTERACTION.focusLinkGreyoutDark,
      })
      options.applyCurrentVisualAttributes(graph, data)
      if (shouldZoom) fitPointIndices(sampleIndices(workFocusState.visiblePoints, 96), WORK_MODE_CAMERA.focusFitDurationMs, WORK_MODE_CAMERA.focusFitPadding)
      graph.render()
    },

    focusLink: (index: number, shouldZoom: boolean) => {
      const graph = options.getCurrentGraph()
      const data = options.getCurrentData()
      const cfg = options.getCurrentConfig()
      if (!graph || !data || !isWorkMode(cfg) || !isCloseWorkZoom(options)) return
      if (workFocusState?.type === 'link' && workFocusState.index === index) {
        if (shouldZoom && workFocusState.endpoints.length > 0) fitPointIndices(workFocusState.endpoints, WORK_MODE_CAMERA.linkFitDurationMs, WORK_MODE_CAMERA.linkFitPadding)
        return
      }
      workFocusState = buildWorkLinkFocusState(graph, index)
      workPreviewState = undefined
      controller.updatePanel()
      graph.setConfigPartial({
        focusedPointIndex: undefined,
        focusedLinkIndex: index,
        highlightedPointIndices: workFocusState.endpoints,
        highlightedLinkIndices: [index],
        outlinedPointIndices: undefined,
        renderLodMode: 'exact',
        pointGreyoutOpacity: cfg.theme === 'light' ? 0.18 : 0.22,
        linkGreyoutOpacity: cfg.theme === 'light' ? 0.04 : 0.06,
      })
      options.applyCurrentVisualAttributes(graph, data)
      if (shouldZoom && workFocusState.endpoints.length > 0) fitPointIndices(workFocusState.endpoints, WORK_MODE_CAMERA.linkFitDurationMs, WORK_MODE_CAMERA.linkFitPadding)
      graph.render()
    },

    fitNeighborhood: () => {
      const graph = options.getCurrentGraph()
      if (!graph || workFocusState?.type !== 'point') return
      fitPointIndices(workFocusState.neighborhood, WORK_MODE_CAMERA.overviewFitDurationMs, 0.26)
    },

    stepIntoPoint: () => {
      const graph = options.getCurrentGraph()
      if (!graph || workFocusState?.type !== 'point') return
      fitPointIndices(sampleIndices([workFocusState.index, ...workFocusState.neighbors], 28), WORK_MODE_CAMERA.stepFitDurationMs, WORK_MODE_CAMERA.stepFitPadding)
    },
  }

  return controller
}
