import type { RenderPass } from '@luma.gl/core'

import {
  bindDrawCurveCommandIfNeeded,
} from '@/graph/modules/Lines/passes/draw/draw-command-bindings'
import {
  drawCulledLinesIndirect,
  drawPrecomputedLines,
  preparePrecomputedLines,
} from '@/graph/modules/Lines/passes/draw/draw-command-execution'
import {
  setDrawLineUniforms,
} from '@/graph/modules/Lines/passes/draw/draw-command-uniforms'
import {
  getEffectiveLineSegments,
  getEffectiveLinkLodStrength,
} from '@/graph/modules/Lines/features/draw-lifecycle/lifecycle'
import type { GpuTimerLike } from '@/graph/modules/Lines/passes/shared/contracts'

import type { LinesRendererContext } from './contracts'

export function drawLinesRenderer (
  lines: LinesRendererContext,
  renderPass: RenderPass,
  usePreparedCulledDraw = false
): void {
  const { config, points } = lines
  if (!prepareLineDrawState(lines)) return
  if (!points) return
  const drawCurveCommand = lines.drawCurveCommand
  const linkStatusTexture = lines.linkStatusTexture
  const currentPositionTexture = points.currentPositionTexture
  if (!drawCurveCommand || !linkStatusTexture || !currentPositionTexture) return
  const hasHighlighting = config.highlightedLinkIndices !== undefined
  setPreparedLineUniforms(lines, hasHighlighting)

  if (usePreparedCulledDraw && lines.visibleLineCullingPass.isPrepared && drawCulledLinesIndirect({
    pass: lines.visibleLineCullingPass,
    renderPass,
    command: lines.drawCulledCurveCommand,
    uniformStore: lines.drawLineUniformStore,
    linkStatusTexture,
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
  })) {
    return
  }

  if (!bindDrawCurveCommandIfNeeded({
    device: lines.device,
    model: lines.drawCurveCommand,
    cache: lines.drawCurveBindingsCache,
    currentPositionTexture,
    positionStorageBuffer: points.positionStorageBuffer,
    previousPositionStorageBuffer: points.previousRenderPositionStorageBuffer,
    linkStatusTexture,
  })) return

  drawCurveCommand.setInstanceCount(lines.data.linksNumber ?? 0)
  drawCurveCommand.draw(renderPass)
}

export function prepareDirectLineDraw (
  lines: LinesRendererContext
): boolean {
  lines.lineInstancePrecomputePass.resetPrepared()
  if (!prepareLineDrawState(lines)) return false
  const hasHighlighting = lines.config.highlightedLinkIndices !== undefined
  setPreparedLineUniforms(lines, hasHighlighting)
  return preparePrecomputedLines({
    pass: lines.lineInstancePrecomputePass,
    command: lines.drawCurveInstancedCommand,
    uniformStore: lines.drawLineUniformStore,
    hasHighlighting,
    pointABuffer: lines.pointABuffer,
    pointBBuffer: lines.pointBBuffer,
    colorBuffer: lines.colorBuffer,
    widthBuffer: lines.widthBuffer,
    arrowBuffer: lines.arrowBuffer,
    linkIndexBuffer: lines.linkIndexBuffer,
  })
}

export function prepareGpuCulledLineDraw (
  lines: LinesRendererContext,
  timer?: GpuTimerLike,
  forcePolicy = false
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

function prepareLineDrawState (lines: LinesRendererContext): boolean {
  const { points } = lines
  if (!points) return false
  if (!points.currentPositionTexture || points.currentPositionTexture.destroyed) return false
  if (!lines.pointABuffer || !lines.pointBBuffer) lines.updatePointsBuffer()
  if (!lines.colorBuffer) lines.updateColor()
  if (!lines.widthBuffer) lines.updateWidth()
  if (!lines.arrowBuffer) lines.updateArrow()
  if (!lines.curveLineGeometry) lines.updateCurveLineGeometry()
  return Boolean(lines.drawCurveCommand && lines.drawLineUniformStore && lines.linkStatusTexture)
}

function setPreparedLineUniforms (lines: LinesRendererContext, hasHighlighting: boolean): void {
  const points = lines.points
  if (!points || !lines.drawLineUniformStore) return
  setDrawLineUniforms({
    uniformStore: lines.drawLineUniformStore,
    runtime: lines.drawLineUniformRuntime,
    config: lines.config,
    store: lines.store,
    renderMode: 0,
    linkLodStrength: getEffectiveLinkLodStrength(lines.config),
    hasHighlighting,
    linkStatusTextureSize: lines.linkStatusTextureSize,
    effectiveLineSegments: getEffectiveLineSegments(lines.config),
    isWebGpu: lines.device.info?.type === 'webgpu',
    renderPositionMix: points.renderPositionMix ?? 1,
    hasArrowedLinks: lines.hasArrowedLinks,
  })
}
