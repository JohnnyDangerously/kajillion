import { Buffer, UniformStore, type Framebuffer, type RenderPass, type Texture } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import { CoreModule } from '@/graph/modules/core-module'
import type { GpuTimerLike } from '@/graph/modules/Lines/passes/shared/contracts'
import {
  createLinkStatusBindingsCache,
} from '@/graph/modules/Lines/passes/shared/link-status-bindings'
import {
  updateLinkStatusTexture,
} from '@/graph/modules/Lines/passes/status/link-status-texture'
import {
  updateLineArrowAttribute,
  updateLineColorAttribute,
  updateLineEndpointAttributes,
  updateLineWidthAttribute,
} from '@/graph/modules/Lines/passes/draw/attribute-lifecycle'
import { updateCurveLineGeometryBuffer } from '@/graph/modules/Lines/passes/draw/curve-geometry-buffer'
import {
  createDrawLineUniformRuntime,
  type LineDrawUniformStoreShape,
} from '@/graph/modules/Lines/passes/draw/draw-command-uniforms'
import {
  type HoveredLineIndexUniformStoreShape,
} from '@/graph/modules/Lines/passes/hover/contracts'
import {
  createHoveredLineIndexBindingsCache,
} from '@/graph/modules/Lines/passes/hover/hovered-line-index-pass'
import { updateLinkIndexFramebuffer } from '@/graph/modules/Lines/passes/hover/link-index-framebuffer'
import { findHoveredLine as findHoveredLinePass } from '@/graph/modules/Lines/passes/hover/line-hover-picking'
import {
  type FillSampledLinksUniformStoreShape,
} from '@/graph/modules/Lines/passes/sampling/contracts'
import {
  getSampledLinkPositionsMap as getSampledLinkPositionsMapPass,
  getSampledLinks as getSampledLinksPass,
  updateSampledLinksGridFramebuffer,
} from '@/graph/modules/Lines/passes/sampling/sampled-links-query'
import {
  LineInstancePrecomputePass,
} from '@/graph/modules/Lines/passes/precompute/line-instance-pass'
import {
  VisibleLineCullingPass,
} from '@/graph/modules/Lines/passes/visible-culling/visible-line-culling-pass'
import { destroyLinesRenderer } from '@/graph/modules/Lines/renderer/destroy'
import { initializeLinesRenderer } from '@/graph/modules/Lines/renderer/init'
import { drawLinesRenderer, prepareGpuCulledLineDraw } from '@/graph/modules/Lines/renderer/draw'

export class Lines extends CoreModule {
  public linkIndexFbo: Framebuffer | undefined
  public hoveredLineIndexFbo: Framebuffer | undefined
  public sampledLinksFbo: Framebuffer | undefined
  public linkStatusTexture: Texture | undefined
  // Cached at updateArrow() time. Lets the line fragment shader skip the
  // arrow-AA branch entirely when no link in the dataset is arrowed.
  public hasArrowedLinks = false
  public readonly lineInstancePrecomputePass = new LineInstancePrecomputePass(this)
  public readonly visibleLineCullingPass = new VisibleLineCullingPass(this)
  public linkStatusTextureSize = 0
  public drawCurveCommand: Model | undefined
  public drawCurveInstancedCommand: Model | undefined
  public drawCulledCurveCommand: Model | undefined
  public drawCurveIndexCommand: Model | undefined
  public hoveredLineIndexCommand: Model | undefined
  public readonly drawCurveBindingsCache = createLinkStatusBindingsCache()
  public readonly drawCurveIndexBindingsCache = createLinkStatusBindingsCache()
  public readonly hoveredLineBindingsCache = createHoveredLineIndexBindingsCache()
  public readonly drawLineUniformRuntime = createDrawLineUniformRuntime()

  public fillSampledLinksFboCommand: Model | undefined
  public pointABuffer: Buffer | undefined
  public pointBBuffer: Buffer | undefined
  public colorBuffer: Buffer | undefined
  public widthBuffer: Buffer | undefined
  public arrowBuffer: Buffer | undefined
  public curveLineGeometry: number[][] | undefined
  public curveLineBuffer: Buffer | undefined
  public linkIndexBuffer: Buffer | undefined
  public quadBuffer: Buffer | undefined
  public linkIndexTexture: Texture | undefined
  public hoveredLineIndexTexture: Texture | undefined
  public fillSampledLinksUniformStore: UniformStore<FillSampledLinksUniformStoreShape> | undefined

  // Uniform stores for scalar uniforms
  public drawLineUniformStore: UniformStore<LineDrawUniformStoreShape> | undefined

  public hoveredLineIndexUniformStore: UniformStore<HoveredLineIndexUniformStoreShape> | undefined

  public hoveredLineIndexUniformBuffer: Buffer | undefined

  // Track previous screen size to detect changes
  public previousScreenSize: [number, number] | undefined

  public initPrograms (): void {
    initializeLinesRenderer(this)
  }

  public draw (renderPass: RenderPass, usePreparedCulledDraw = false): void {
    drawLinesRenderer(this, renderPass, usePreparedCulledDraw)
  }

  public prepareGpuCulledDraw (timer?: GpuTimerLike, forcePolicy = false): boolean {
    return prepareGpuCulledLineDraw(this, timer, forcePolicy)
  }

  public updateLinkIndexFbo (): void {
    updateLinkIndexFramebuffer(this)
  }

  public updateSampledLinksGrid (): void {
    updateSampledLinksGridFramebuffer(this)
  }

  public updatePointsBuffer (): void {
    updateLineEndpointAttributes(this)
  }

  public updateColor (): void {
    updateLineColorAttribute(this)
  }

  public updateWidth (): void {
    updateLineWidthAttribute(this)
  }

  public updateArrow (): void {
    updateLineArrowAttribute(this)
  }

  public updateLinkStatus (): void {
    const state = updateLinkStatusTexture({
      device: this.device,
      texture: this.linkStatusTexture,
      textureSize: this.linkStatusTextureSize,
      linksNumber: this.data.linksNumber ?? 0,
      highlightedLinkIndices: this.config.highlightedLinkIndices,
    })
    this.linkStatusTexture = state.texture
    this.linkStatusTextureSize = state.textureSize
  }

  public updateCurveLineGeometry (): void {
    updateCurveLineGeometryBuffer(this)
  }

  public getSampledLinkPositionsMap (): Map<number, [number, number, number]> {
    return getSampledLinkPositionsMapPass(this)
  }

  public getSampledLinks (): { indices: number[]; positions: number[]; angles: number[] } {
    return getSampledLinksPass(this)
  }

  public findHoveredLine (): void {
    findHoveredLinePass(this)
  }

  public destroy (): void {
    destroyLinesRenderer(this)
  }

  public markActiveLinkMaskDirty (): void {
    this.visibleLineCullingPass.markActiveLinkMaskDirty()
  }
}
