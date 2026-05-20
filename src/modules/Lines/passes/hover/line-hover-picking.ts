import {
  getEffectiveLineSegments,
  getHoverPickScissorRect,
} from '@/graph/modules/Lines/features/draw-lifecycle/lifecycle'
import { bindDrawCurveIndexCommandIfNeeded } from '@/graph/modules/Lines/passes/draw/draw-command-bindings'
import { setDrawLineUniforms } from '@/graph/modules/Lines/passes/draw/draw-command-uniforms'
import { renderHoveredLineIndexPass } from '@/graph/modules/Lines/passes/hover/hovered-line-index-pass'
import type { LinesRendererContext } from '@/graph/modules/Lines/renderer/contracts'

export function findHoveredLine (lines: LinesRendererContext): void {
  const { config, points, store } = lines
  if (!points) return
  if (!points.currentPositionTexture || points.currentPositionTexture.destroyed) return
  if (!lines.data.linksNumber || !lines.store.isLinkHoveringEnabled) return
  if (!lines.linkIndexFbo || !lines.drawCurveCommand || !lines.drawCurveIndexCommand || !lines.drawLineUniformStore || !lines.linkStatusTexture) return
  if (!lines.linkIndexTexture || lines.linkIndexTexture.destroyed) return

  const hasHighlighting = config.highlightedLinkIndices !== undefined

  setDrawLineUniforms({
    uniformStore: lines.drawLineUniformStore,
    runtime: lines.drawLineUniformRuntime,
    config: lines.config,
    store: lines.store,
    renderMode: 1,
    linkLodStrength: 0,
    hasHighlighting,
    linkStatusTextureSize: lines.linkStatusTextureSize,
    effectiveLineSegments: getEffectiveLineSegments(config),
    isWebGpu: lines.device.info?.type === 'webgpu',
    renderPositionMix: points.renderPositionMix ?? 1,
    hasArrowedLinks: lines.hasArrowedLinks,
  })

  // Update texture bindings dynamically -- uniforms are shared, but we draw via
  // the index-specific Model which has blend: false so picking IDs aren't
  // corrupted by linkBlendMode='add'.
  if (!bindDrawCurveIndexCommandIfNeeded({
    device: lines.device,
    model: lines.drawCurveIndexCommand,
    cache: lines.drawCurveIndexBindingsCache,
    currentPositionTexture: points.currentPositionTexture,
    positionStorageBuffer: points.positionStorageBuffer,
    previousPositionStorageBuffer: points.previousRenderPositionStorageBuffer,
    linkStatusTexture: lines.linkStatusTexture,
  })) return

  lines.drawCurveIndexCommand.setInstanceCount(lines.data.linksNumber ?? 0)

  // Render to index buffer for picking/hover detection
  const indexPass = lines.device.beginRenderPass({
    framebuffer: lines.linkIndexFbo,
    // Clear framebuffer to transparent black (luma.gl default would be opaque black)
    clearColor: [0, 0, 0, 0],
    parameters: {
      scissorRect: getHoverPickScissorRect(
        lines.device.info?.type === 'webgpu',
        store.screenSize,
        store.screenMousePosition
      ),
    },
  })
  lines.drawCurveIndexCommand.draw(indexPass)
  indexPass.end()

  if (lines.hoveredLineIndexCommand && lines.hoveredLineIndexFbo && lines.hoveredLineIndexUniformStore) {
    lines.hoveredLineIndexUniformBuffer = renderHoveredLineIndexPass({
      device: lines.device,
      command: lines.hoveredLineIndexCommand,
      framebuffer: lines.hoveredLineIndexFbo,
      uniformStore: lines.hoveredLineIndexUniformStore,
      uniformBuffer: lines.hoveredLineIndexUniformBuffer,
      bindingsCache: lines.hoveredLineBindingsCache,
      linkIndexTexture: lines.linkIndexTexture,
      mousePosition: store.screenMousePosition,
      screenSize: store.screenSize,
    })
  }
}
