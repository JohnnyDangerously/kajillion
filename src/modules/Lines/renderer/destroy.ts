import { resetLinkStatusBindingsCache } from '@/graph/modules/Lines/passes/shared/link-status-bindings'
import { resetHoveredLineIndexBindingsCache } from '@/graph/modules/Lines/passes/hover/hovered-line-index-pass'
import type { LinesRendererContext } from './contracts'

/**
 * Destruction order matters
 * Models -> Framebuffers -> Textures -> UniformStores -> Buffers
 */
export function destroyLinesRenderer (lines: LinesRendererContext): void {
  // 1. Destroy Models FIRST (they destroy _gpuGeometry if exists, and _uniformStore)
  lines.drawCurveCommand?.destroy()
  lines.drawCurveInstancedCommand?.destroy()
  lines.drawCulledCurveCommand?.destroy()
  lines.drawCurveIndexCommand?.destroy()
  lines.drawCurveCommand = undefined
  lines.drawCurveInstancedCommand = undefined
  lines.drawCulledCurveCommand = undefined
  lines.hoveredLineIndexCommand?.destroy()
  lines.hoveredLineIndexCommand = undefined
  lines.hoveredLineIndexUniformBuffer = undefined
  resetLinkStatusBindingsCache(lines.drawCurveBindingsCache)
  resetLinkStatusBindingsCache(lines.drawCurveIndexBindingsCache)
  resetHoveredLineIndexBindingsCache(lines.hoveredLineBindingsCache)
  lines.fillSampledLinksFboCommand?.destroy()
  lines.fillSampledLinksFboCommand = undefined

  // 2. Destroy Framebuffers (before textures they reference)
  if (lines.linkIndexFbo && !lines.linkIndexFbo.destroyed) {
    lines.linkIndexFbo.destroy()
  }
  lines.linkIndexFbo = undefined
  if (lines.sampledLinksFbo && !lines.sampledLinksFbo.destroyed) {
    lines.sampledLinksFbo.destroy()
  }
  lines.sampledLinksFbo = undefined
  if (lines.hoveredLineIndexFbo && !lines.hoveredLineIndexFbo.destroyed) {
    lines.hoveredLineIndexFbo.destroy()
  }
  lines.hoveredLineIndexFbo = undefined

  // 3. Destroy Textures
  if (lines.linkIndexTexture && !lines.linkIndexTexture.destroyed) {
    lines.linkIndexTexture.destroy()
  }
  lines.linkIndexTexture = undefined
  if (lines.hoveredLineIndexTexture && !lines.hoveredLineIndexTexture.destroyed) {
    lines.hoveredLineIndexTexture.destroy()
  }
  lines.hoveredLineIndexTexture = undefined
  if (lines.linkStatusTexture && !lines.linkStatusTexture.destroyed) {
    lines.linkStatusTexture.destroy()
  }
  lines.linkStatusTexture = undefined

  // 4. Destroy UniformStores (Models already destroyed their managed uniform buffers)
  lines.drawLineUniformStore?.destroy()
  lines.drawLineUniformStore = undefined
  lines.hoveredLineIndexUniformStore?.destroy()
  lines.hoveredLineIndexUniformStore = undefined
  lines.fillSampledLinksUniformStore?.destroy()
  lines.fillSampledLinksUniformStore = undefined

  // 5. Destroy Buffers (passed via attributes - NOT owned by Models, must destroy manually)
  if (lines.pointABuffer && !lines.pointABuffer.destroyed) {
    lines.pointABuffer.destroy()
  }
  lines.pointABuffer = undefined
  if (lines.pointBBuffer && !lines.pointBBuffer.destroyed) {
    lines.pointBBuffer.destroy()
  }
  lines.pointBBuffer = undefined
  if (lines.colorBuffer && !lines.colorBuffer.destroyed) {
    lines.colorBuffer.destroy()
  }
  lines.colorBuffer = undefined
  if (lines.widthBuffer && !lines.widthBuffer.destroyed) {
    lines.widthBuffer.destroy()
  }
  lines.widthBuffer = undefined
  if (lines.arrowBuffer && !lines.arrowBuffer.destroyed) {
    lines.arrowBuffer.destroy()
  }
  lines.arrowBuffer = undefined
  if (lines.curveLineBuffer && !lines.curveLineBuffer.destroyed) {
    lines.curveLineBuffer.destroy()
  }
  lines.curveLineBuffer = undefined
  if (lines.linkIndexBuffer && !lines.linkIndexBuffer.destroyed) {
    lines.linkIndexBuffer.destroy()
  }
  lines.linkIndexBuffer = undefined
  lines.lineInstancePrecomputePass.destroy()
  lines.visibleLineCullingPass.destroy()
  if (lines.quadBuffer && !lines.quadBuffer.destroyed) {
    lines.quadBuffer.destroy()
  }
  lines.quadBuffer = undefined
}
