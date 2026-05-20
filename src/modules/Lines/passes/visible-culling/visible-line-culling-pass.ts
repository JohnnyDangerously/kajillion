import type { Buffer, Device, RenderPass, Texture, UniformStore } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import type { GraphConfigInterface } from '@/graph/config'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Points } from '@/graph/modules/Points'
import type { Store } from '@/graph/modules/Store'
import type {
  GpuTimerLike,
} from '@/graph/modules/Lines/passes/shared/contracts'
import type { LineDrawUniformStoreShape } from '@/graph/modules/Lines/passes/draw/contracts'
import { ensureVisibleLineBuffers } from '@/graph/modules/Lines/passes/visible-culling/buffers'
import { updateActiveLineMask } from '@/graph/modules/Lines/passes/visible-culling/active-mask'
import { ensureVisibleLinePipelines } from '@/graph/modules/Lines/passes/visible-culling/pipelines'
import { getVisibleLinePrepareContext } from '@/graph/modules/Lines/passes/visible-culling/prepare-context'
import {
  runVisibleLineClearDispatch,
  runVisibleLineCullDispatch,
} from '@/graph/modules/Lines/passes/visible-culling/dispatch'
import { drawVisibleLines } from '@/graph/modules/Lines/passes/visible-culling/draw'
import {
  createActiveLineMaskState,
  createVisibleLineBufferState,
  createVisibleLinePipelineState,
  destroyActiveLineMaskState,
  destroyVisibleLineBufferState,
  destroyVisibleLinePipelineState,
} from '@/graph/modules/Lines/passes/visible-culling/resource-state'

export interface VisibleLineCullingHost {
  readonly device: Device;
  readonly config: GraphConfigInterface;
  readonly data: GraphData;
  readonly points: Points | undefined;
  readonly store: Store;
}

export class VisibleLineCullingPass {
  private prepared = false
  private visibleLineBuffers = createVisibleLineBufferState()
  private activeLineMask = createActiveLineMaskState()
  private pipelines = createVisibleLinePipelineState()

  public constructor (private readonly host: VisibleLineCullingHost) {}

  public get isPrepared (): boolean {
    return this.prepared
  }

  public resetPrepared (): void {
    this.prepared = false
  }

  public markActiveLinkMaskDirty (): void {
    this.activeLineMask.activeLineMaskDirty = true
  }

  public prepare (
    timer: GpuTimerLike | undefined,
    forcePolicy: boolean,
    pointABuffer: Buffer,
    pointBBuffer: Buffer,
    vertexCount: number
  ): boolean {
    this.prepared = false
    const { config, device, store } = this.host
    const context = getVisibleLinePrepareContext(this.host, forcePolicy, pointABuffer, pointBBuffer, vertexCount)
    if (!context) return false
    const { linkCount, linkLodRange, linkLodStrength, points } = context

    this.assignVisibleLineBuffers(linkCount, vertexCount)
    this.assignActiveLineMask()
    this.assignPipelines(vertexCount)
    const { visibleLineIndexBuffer, visibleLineIndirectBuffer } = this.visibleLineBuffers
    const { activeLineMaskBuffer } = this.activeLineMask
    const { clearPipeline, clearUniformStore, clearUniformBuffer, cullPipeline, cullUniformStore, cullUniformBuffer } = this.pipelines
    if (
      !visibleLineIndexBuffer ||
      !visibleLineIndirectBuffer ||
      !activeLineMaskBuffer ||
      !clearPipeline ||
      !cullPipeline ||
      !clearUniformStore ||
      !clearUniformBuffer ||
      !cullUniformStore ||
      !cullUniformBuffer
    ) {
      return false
    }

    runVisibleLineClearDispatch({
      clearPipeline,
      clearUniformBuffer,
      clearUniformStore,
      device,
      timer,
      vertexCount,
      visibleLineIndirectBuffer,
    })

    runVisibleLineCullDispatch({
      activeLineMaskBuffer,
      config,
      cullPipeline,
      cullUniformBuffer,
      cullUniformStore,
      device,
      linkCount,
      linkLodRange,
      linkLodStrength,
      pointABuffer,
      pointBBuffer,
      points,
      store,
      timer,
      visibleLineIndexBuffer,
      visibleLineIndirectBuffer,
    })

    this.prepared = true
    return true
  }

  public draw (
    renderPass: RenderPass,
    model: Model | undefined,
    drawLineUniformStore: UniformStore<LineDrawUniformStoreShape> | undefined,
    linkStatusTexture: Texture | undefined,
    pointABuffer: Buffer | undefined,
    pointBBuffer: Buffer | undefined,
    colorBuffer: Buffer | undefined,
    widthBuffer: Buffer | undefined,
    arrowBuffer: Buffer | undefined
  ): boolean {
    return drawVisibleLines({
      arrowBuffer,
      colorBuffer,
      drawLineUniformStore,
      host: this.host,
      linkStatusTexture,
      model,
      pointABuffer,
      pointBBuffer,
      prepared: this.prepared,
      renderPass,
      visibleLineIndexBuffer: this.visibleLineBuffers.visibleLineIndexBuffer,
      visibleLineIndirectBuffer: this.visibleLineBuffers.visibleLineIndirectBuffer,
      widthBuffer,
    })
  }

  public destroy (): void {
    this.visibleLineBuffers = destroyVisibleLineBufferState(this.visibleLineBuffers)
    this.activeLineMask = destroyActiveLineMaskState(this.activeLineMask)
    this.prepared = false
    this.pipelines = destroyVisibleLinePipelineState(this.pipelines)
  }

  private assignVisibleLineBuffers (linkCount: number, vertexCount: number): void {
    this.visibleLineBuffers = ensureVisibleLineBuffers(this.host.device, this.visibleLineBuffers, linkCount, vertexCount)
  }

  private assignActiveLineMask (): void {
    const { config, data, device } = this.host
    this.activeLineMask = updateActiveLineMask({
      device,
      linkCount: data.linksNumber ?? 0,
      activeLinkIndices: config.activeLinkIndices,
      state: this.activeLineMask,
    })
  }

  private assignPipelines (vertexCount: number): void {
    this.pipelines = ensureVisibleLinePipelines({
      ...this.host,
      vertexCount,
      state: this.pipelines,
    })
  }

}
