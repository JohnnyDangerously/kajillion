import type { RenderPass } from '@luma.gl/core'

import {
  bindDrawCurveCommandIfNeeded,
} from '@/graph/modules/Lines/passes/draw/draw-command-bindings'
import {
  drawCulledLinesIndirect,
  drawPrecomputedLines,
} from '@/graph/modules/Lines/passes/draw/draw-command-execution'
import {
  setDrawLineUniforms,
} from '@/graph/modules/Lines/passes/draw/draw-command-uniforms'
import {
  getEffectiveLineSegments,
  getEffectiveLinkLodStrength,
} from '@/graph/modules/Lines/features/draw-lifecycle/lifecycle'
import type { GpuTimerLike } from '@/graph/modules/Lines/passes/shared/contracts'

import type { Lines } from './lines'

export function drawLinesRenderer (
  lines: Lines,
  renderPass: RenderPass,
  usePreparedCulledDraw = false,
): void {
  const { config, points } = lines
  if (!points) return
  if (!points.currentPositionTexture || points.currentPositionTexture.destroyed) return
  if (!lines.pointABuffer || !lines.pointBBuffer) lines.updatePointsBuffer()
  if (!lines.colorBuffer) lines.updateColor()
  if (!lines.widthBuffer) lines.updateWidth()
  if (!lines.arrowBuffer) lines.updateArrow()
  if (!lines.curveLineGeometry) lines.updateCurveLineGeometry()
  if (!lines.drawCurveCommand || !lines.drawLineUniformStore || !lines.linkStatusTexture) return

  const hasHighlighting = config.highlightedLinkIndices !== undefined

  setDrawLineUniforms({
    uniformStore: lines.drawLineUniformStore,
    runtime: lines.drawLineUniformRuntime,
    config: lines.config,
    store: lines.store,
    renderMode: 0,
    linkLodStrength: getEffectiveLinkLodStrength(config),
    hasHighlighting,
    linkStatusTextureSize: lines.linkStatusTextureSize,
    effectiveLineSegments: getEffectiveLineSegments(config),
    isWebGpu: lines.device.info?.type === 'webgpu',
    renderPositionMix: points.renderPositionMix ?? 1,
    hasArrowedLinks: lines.hasArrowedLinks,
  })

  if (usePreparedCulledDraw && lines.visibleLineCullingPass.isPrepared && drawCulledLinesIndirect({
    pass: lines.visibleLineCullingPass,
    renderPass,
    command: lines.drawCulledCurveCommand,
    uniformStore: lines.drawLineUniformStore,
    linkStatusTexture: lines.linkStatusTexture,
    pointABuffer: lines.pointABuffer,
    pointBBuffer: lines.pointBBuffer,
    colorBuffer: lines.colorBuffer,
    widthBuffer: lines.widthBuffer,
    arrowBuffer: lines.arrowBuffer,
  })) {
    return
  }

  if (drawPrecomputedLines({
    pass: lines.lineInstancePrecomputePass,
    renderPass,
    command: lines.drawCurveInstancedCommand,
    uniformStore: lines.drawLineUniformStore,
    hasHighlighting,
    pointABuffer: lines.pointABuffer,
    pointBBuffer: lines.pointBBuffer,
    colorBuffer: lines.colorBuffer,
    widthBuffer: lines.widthBuffer,
    arrowBuffer: lines.arrowBuffer,
    linkIndexBuffer: lines.linkIndexBuffer,
  })) {
    return
  }

  if (!bindDrawCurveCommandIfNeeded({
    device: lines.device,
    model: lines.drawCurveCommand,
    cache: lines.drawCurveBindingsCache,
    currentPositionTexture: points.currentPositionTexture,
    positionStorageBuffer: points.positionStorageBuffer,
    previousPositionStorageBuffer: points.previousRenderPositionStorageBuffer,
    linkStatusTexture: lines.linkStatusTexture,
  })) return

  lines.drawCurveCommand.setInstanceCount(lines.data.linksNumber ?? 0)
  lines.drawCurveCommand.draw(renderPass)
}

export function prepareGpuCulledLineDraw (
  lines: Lines,
  timer?: GpuTimerLike,
  forcePolicy = false,
): boolean {
  lines.visibleLineCullingPass.resetPrepared()
  if (lines.device.info?.type !== 'webgpu') return false
  if (!lines.pointABuffer || !lines.pointBBuffer) lines.updatePointsBuffer()
  if (!lines.pointABuffer || lines.pointABuffer.destroyed) return false
  if (!lines.pointBBuffer || lines.pointBBuffer.destroyed) return false
  if (!lines.curveLineGeometry) lines.updateCurveLineGeometry()
  const vertexCount = lines.curveLineGeometry?.length ?? 0
  if (vertexCount === 0) return false

  return lines.visibleLineCullingPass.prepare(
    timer,
    forcePolicy,
    lines.pointABuffer,
    lines.pointBBuffer,
    vertexCount
  )
}
