import { Buffer } from '@luma.gl/core'

import {
  createHoveredLineIndexCommand,
  createHoveredLineIndexUniformStore,
  ensureHoveredLineIndexFramebuffer,
  ensureHoveredLineIndexUniformBuffer,
  getHoveredLineUniformBindingName,
} from '@/graph/modules/Lines/passes/hover/hovered-line-index-pass'
import {
  createSampledLinksCommand,
  createSampledLinksUniformStore,
} from '@/graph/modules/Lines/passes/sampling/sampled-links-renderer'
import {
  createDrawLineUniformStore,
} from '@/graph/modules/Lines/passes/draw/draw-command-uniforms'
import {
  ensureLineDrawPrograms,
} from '@/graph/modules/Lines/passes/draw/program-lifecycle'

import type { LinesRendererContext } from './contracts'

export function initializeLinesRenderer (lines: LinesRendererContext): void {
  const { device, config, store, data } = lines

  lines.updateLinkIndexFbo()

  const hoveredLineIndexFramebuffer = ensureHoveredLineIndexFramebuffer(
    device,
    lines.hoveredLineIndexTexture,
    lines.hoveredLineIndexFbo
  )
  lines.hoveredLineIndexTexture = hoveredLineIndexFramebuffer.texture
  lines.hoveredLineIndexFbo = hoveredLineIndexFramebuffer.framebuffer

  if (!lines.curveLineGeometry) {
    lines.updateCurveLineGeometry()
  }

  const linksNumber = data.linksNumber ?? 0
  lines.drawLineUniformStore ||= createDrawLineUniformStore({
    config,
    store,
    isWebGpu: device.info?.type === 'webgpu',
  })

  const drawPrograms = ensureLineDrawPrograms({
    device,
    config,
    linksNumber,
    curveLineGeometry: lines.curveLineGeometry,
    curveLineBuffer: lines.curveLineBuffer,
    uniformStore: lines.drawLineUniformStore,
    pointABuffer: lines.pointABuffer,
    pointBBuffer: lines.pointBBuffer,
    colorBuffer: lines.colorBuffer,
    widthBuffer: lines.widthBuffer,
    arrowBuffer: lines.arrowBuffer,
    linkIndexBuffer: lines.linkIndexBuffer,
    drawCurveCommand: lines.drawCurveCommand,
    drawCurveInstancedCommand: lines.drawCurveInstancedCommand,
    drawCulledCurveCommand: lines.drawCulledCurveCommand,
    drawCurveIndexCommand: lines.drawCurveIndexCommand,
    getLineInstanceBuffer: linkCount => lines.lineInstancePrecomputePass.getOrCreateLineInstanceBuffer(linkCount),
  })
  lines.pointABuffer = drawPrograms.pointABuffer
  lines.pointBBuffer = drawPrograms.pointBBuffer
  lines.colorBuffer = drawPrograms.colorBuffer
  lines.widthBuffer = drawPrograms.widthBuffer
  lines.arrowBuffer = drawPrograms.arrowBuffer
  lines.linkIndexBuffer = drawPrograms.linkIndexBuffer
  lines.drawCurveCommand = drawPrograms.drawCurveCommand
  lines.drawCurveInstancedCommand = drawPrograms.drawCurveInstancedCommand
  lines.drawCulledCurveCommand = drawPrograms.drawCulledCurveCommand
  lines.drawCurveIndexCommand = drawPrograms.drawCurveIndexCommand

  lines.quadBuffer ||= device.createBuffer({
    data: new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    usage: Buffer.VERTEX | Buffer.COPY_DST,
  })

  lines.hoveredLineIndexUniformStore ||= createHoveredLineIndexUniformStore({
    mousePosition: store.screenMousePosition,
    screenSize: store.screenSize,
  })

  lines.hoveredLineIndexUniformBuffer = ensureHoveredLineIndexUniformBuffer(
    device,
    lines.hoveredLineIndexUniformStore,
    lines.hoveredLineIndexUniformBuffer
  )
  lines.hoveredLineIndexCommand ||= createHoveredLineIndexCommand({
    device,
    quadBuffer: lines.quadBuffer,
    uniformBindingName: getHoveredLineUniformBindingName(device),
    uniformBuffer: lines.hoveredLineIndexUniformBuffer,
  })

  lines.fillSampledLinksUniformStore ||= createSampledLinksUniformStore(store, config)
  lines.fillSampledLinksFboCommand ||= createSampledLinksCommand({
    device,
    uniformStore: lines.fillSampledLinksUniformStore,
    attributes: {
      pointABuffer: lines.pointABuffer,
      pointBBuffer: lines.pointBBuffer,
      linkIndexBuffer: lines.linkIndexBuffer,
    },
    linksNumber: data.linksNumber ?? 0,
  })

  lines.updateSampledLinksGrid()
  lines.updateLinkStatus()
}
